import { useState, useCallback, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/services/supabaseClient';

const SEARCH_HISTORY_KEY = 'searchHistory';
const MAX_HISTORY_ITEMS = 50;

interface HistoryItem {
  id: string; // uuid from Supabase
  query: string;
  title?: string;
  itemId?: string;
  timestamp: string;
  image?: string;
  link?: string;
  price?: number | string;
  [key: string]: any;
}

export function useSearchHistory() {
  const [searchHistory, setSearchHistory] = useState<HistoryItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id ?? null);
    });
  }, []);

  // Load search history on mount
  useEffect(() => {
    const loadSearchHistory = async () => {
      if (userId && isOnline) {
        // Try to fetch from Supabase
        const { data, error } = await supabase
          .from('searches')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(MAX_HISTORY_ITEMS);
        if (error) {
          setIsOnline(false);
          // fallback to local
        } else if (data && data.length > 0) {
          setSearchHistory(data.map((row: any) => ({
            id: row.id,
            query: row.query,
            title: row.ai_keywords || '',
            itemId: row.item_id || '',
            timestamp: row.created_at,
            image: row.image_url || '',
            link: row.link || '',
            price: row.price,
            ...row
          }) as HistoryItem));
          return;
        } else {
          // Supabase is empty, try to load from local and merge
          try {
            const savedHistory = await SecureStore.getItemAsync(SEARCH_HISTORY_KEY);
            if (savedHistory) {
              const parsed = JSON.parse(savedHistory);
              const localItems: HistoryItem[] = Array.isArray(parsed)
                ? parsed.map((item: any) => ({
                    id: typeof item.id === 'string' ? item.id : Math.random().toString(36).substr(2, 9),
                    query: typeof item.query === 'string' ? item.query : '',
                    title: typeof item.title === 'string' ? item.title : '',
                    itemId: typeof item.itemId === 'string' ? item.itemId : '',
                    timestamp: typeof item.timestamp === 'string' ? item.timestamp : new Date().toISOString(),
                    image: typeof item.image === 'string' ? item.image : '',
                    link: typeof item.link === 'string' ? item.link : '',
                    price: typeof item.price === 'number' || typeof item.price === 'string' ? item.price : undefined,
                  }) as HistoryItem)
                : [];
              setSearchHistory(localItems);
              return;
            }
          } catch (error) {
            console.error('Error loading search history:', error);
          }
        }
      }
      // Fallback: load from SecureStore
      try {
        const savedHistory = await SecureStore.getItemAsync(SEARCH_HISTORY_KEY);
        if (savedHistory) {
          const parsed = JSON.parse(savedHistory);
          setSearchHistory(
            Array.isArray(parsed)
              ? parsed.map((item: any) => ({
                  id: typeof item.id === 'string' ? item.id : Math.random().toString(36).substr(2, 9),
                  query: typeof item.query === 'string' ? item.query : '',
                  title: typeof item.title === 'string' ? item.title : '',
                  itemId: typeof item.itemId === 'string' ? item.itemId : '',
                  timestamp: typeof item.timestamp === 'string' ? item.timestamp : new Date().toISOString(),
                  image: typeof item.image === 'string' ? item.image : '',
                  link: typeof item.link === 'string' ? item.link : '',
                  price: typeof item.price === 'number' || typeof item.price === 'string' ? item.price : undefined,
                }) as HistoryItem)
              : []
          );
        }
      } catch (error) {
        console.error('Error loading search history:', error);
      }
    };
    loadSearchHistory();
  }, [userId, isOnline]);

  // Save search history to local only if offline
  useEffect(() => {
    if (!isOnline) {
      const saveSearchHistory = async () => {
        try {
          await SecureStore.setItemAsync(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory));
        } catch (error) {
          console.error('Error saving search history:', error);
        }
      };
      if (searchHistory.length > 0) {
        saveSearchHistory();
      }
    }
  }, [searchHistory, isOnline]);

  // Add an item to search history
  const addToHistory = useCallback(async (item: Omit<HistoryItem, 'id' | 'timestamp'> & { timestamp?: string }) => {
    const newItem: HistoryItem = {
      query: (item as any).query || '',
      title: (item as any).title || '',
      itemId: (item as any).itemId || '',
      image: (item as any).image || '',
      link: (item as any).link || '',
      price: (item as any).price,
      timestamp: new Date().toISOString(),
      id: '', // id will be set by Supabase or random below
    };
    if (userId && isOnline) {
      // Debug logging
      console.log('[addToHistory] userId:', userId);
      console.log('[addToHistory] insert payload:', {
        user_id: userId,
        query: newItem.query,
        ai_keywords: newItem.title || '',
        item_id: newItem.itemId,
        image_url: newItem.image || '',
        link: newItem.link || '',
        price: newItem.price,
        created_at: newItem.timestamp,
      });
      // Insert into Supabase
      const { data, error } = await supabase
        .from('searches')
        .insert({
          user_id: userId,
          query: newItem.query,
          ai_keywords: newItem.title || '',
          item_id: newItem.itemId,
          image_url: newItem.image || '',
          link: newItem.link || '',
          price: newItem.price,
          created_at: newItem.timestamp,
        })
        .select();
      console.log('[addToHistory] Supabase response:', { data, error });
      if (!error && data && data[0]) {
        setSearchHistory(prev => [
          {
            id: data[0].id,
            query: data[0].query,
            title: data[0].ai_keywords,
            itemId: data[0].item_id,
            image: data[0].image_url,
            link: data[0].link,
            price: data[0].price,
            timestamp: data[0].created_at,
            ...data[0]
          } as HistoryItem,
          ...prev
        ].slice(0, MAX_HISTORY_ITEMS));
      }
    } else {
      // Fallback: local
      setSearchHistory(prev => [
        {
          id: Math.random().toString(36).substr(2, 9),
          query: newItem.query,
          title: newItem.title || '',
          itemId: newItem.itemId,
          image: newItem.image || '',
          link: newItem.link || '',
          price: newItem.price,
          timestamp: newItem.timestamp,
        } as HistoryItem,
        ...prev
      ].slice(0, MAX_HISTORY_ITEMS));
    }
  }, [userId, isOnline]);

  // Remove an item from search history
  const removeFromHistory = useCallback(async (id: string) => {
    if (userId && isOnline) {
      await supabase.from('searches').delete().eq('id', id).eq('user_id', userId);
    }
    setSearchHistory(prev => prev.filter(item => (item as HistoryItem).id !== id && (item as HistoryItem).query && typeof (item as HistoryItem).query === 'string'));
  }, [userId, isOnline]);

  // Clear all search history
  const clearSearchHistory = useCallback(async () => {
    if (userId && isOnline) {
      await supabase.from('searches').delete().eq('user_id', userId);
    }
    setSearchHistory([]);
    if (!isOnline) {
      try {
        await SecureStore.deleteItemAsync(SEARCH_HISTORY_KEY);
      } catch (error) {
        console.error('Error clearing search history:', error);
      }
    }
  }, [userId, isOnline]);

  // Manual refresh from Supabase
  const refreshFromSupabase = useCallback(async () => {
    if (userId && isOnline) {
      const { data, error } = await supabase
        .from('searches')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(MAX_HISTORY_ITEMS);
      if (!error && data && data.length > 0) {
        setSearchHistory(data.map((row: any) => ({
          id: row.id,
          query: row.query,
          title: row.ai_keywords || '',
          itemId: row.item_id || '',
          timestamp: row.created_at,
          image: row.image_url || '',
          link: row.link || '',
          price: row.price,
          ...row
        }) as HistoryItem));
      }
    }
  }, [userId, isOnline]);

  return { 
    searchHistory, 
    addToHistory, 
    removeFromHistory, 
    clearSearchHistory, 
    refreshFromSupabase
  };
}