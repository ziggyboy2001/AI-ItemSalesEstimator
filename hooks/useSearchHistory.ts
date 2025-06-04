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
  searchType?: 'sold' | 'current'; // Track if this was from sold or current listings search
  [key: string]: any;
}

export function useSearchHistory() {
  const [searchHistory, setSearchHistory] = useState<HistoryItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id ?? null);
    });
  }, []);

  // Load search history on mount
  useEffect(() => {
    const loadSearchHistory = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      
      if (userId && isOnline) {
        // Try to fetch from Supabase
        const { data, error } = await supabase
          .from('searches')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(MAX_HISTORY_ITEMS);
        
        if (error) {
          console.error('Error loading search history from Supabase:', error);
          setIsOnline(false);
          // Fallback to local storage
        } else if (data && data.length > 0) {
          setSearchHistory(data.map((row: any) => {
            // If we have complete data from the data column, use it
            if (row.data && typeof row.data === 'object') {
              return {
                id: row.id,
                timestamp: row.created_at,
                // Use all data from the data column (complete SearchResult object)
                ...row.data,
                // Ensure these core fields are always present from the individual columns
                query: row.query,
                searchType: row.search_type || 'sold',
              } as HistoryItem;
            } else {
              // Fallback to individual columns for older entries
              return {
                id: row.id,
                query: row.query,
                title: row.ai_keywords || row.title || '',
                itemId: row.item_id || '',
                timestamp: row.created_at,
                image: row.image_url || '',
                link: row.link || '',
                price: row.price,
                searchType: row.search_type || 'sold',
              } as HistoryItem;
            }
          }));
          setIsLoading(false);
          return;
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
                  searchType: item.searchType || 'sold', // Default to sold for backwards compatibility
                  // Preserve all additional fields for current listings
                  ...Object.keys(item).reduce((acc, key) => {
                    if (!['id', 'query', 'title', 'itemId', 'timestamp', 'image', 'link', 'price', 'searchType'].includes(key)) {
                      acc[key] = item[key];
                    }
                    return acc;
                  }, {} as any)
                }) as HistoryItem)
              : []
          );
        }
      } catch (error) {
        console.error('Error loading search history:', error);
      }
      
      setIsLoading(false);
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
  const addToHistory = useCallback(async (item: Omit<HistoryItem, 'id' | 'timestamp'> & { timestamp?: string; searchType?: 'sold' | 'current' }) => {
    // Prevent duplicate entries for the same query within the last hour
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const existingIndex = searchHistory.findIndex(existing => 
      existing.query.toLowerCase() === item.query.toLowerCase() && 
      new Date(existing.timestamp) > oneHourAgo
    );
    
    if (existingIndex !== -1) {
      // Remove the existing entry so it can be re-added at the top
      setSearchHistory(prev => prev.filter((_, index) => index !== existingIndex));
    }

    const newItem = {
      query: item.query,
      title: item.title || '',
      itemId: item.itemId || '',
      image: item.image || '',
      link: item.link || '',
      price: item.price,
      timestamp: item.timestamp || now.toISOString(),
      searchType: item.searchType || 'sold', // Default to sold if not specified
      // Preserve all additional fields for current listings (seller, additionalImages, etc.)
      ...Object.keys(item).reduce((acc, key) => {
        if (!['query', 'title', 'itemId', 'image', 'link', 'price', 'timestamp', 'searchType'].includes(key)) {
          acc[key] = item[key];
        }
        return acc;
      }, {} as any)
    };
    
    if (userId && isOnline) {
      // Insert into Supabase with complete data object
      const { data, error } = await supabase
        .from('searches')
        .insert({
          user_id: userId,
          query: newItem.query,
          ai_keywords: newItem.title || '',
          item_id: newItem.itemId,
          image_url: newItem.image || '',
          link: newItem.link || '',
          price: newItem.price ? Number(newItem.price) : null,
          search_type: newItem.searchType,
          data: newItem, // Store the complete SearchResult object
        })
        .select();
      
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
            searchType: data[0].search_type || 'sold',
            // Use complete data from the data column if available, otherwise fall back to individual fields
            ...(data[0].data || {}),
          } as HistoryItem,
          ...prev
        ].slice(0, MAX_HISTORY_ITEMS));
      } else if (error) {
        console.error('Error saving to search history:', error);
        // Fallback to local storage
        setSearchHistory(prev => [
          {
            id: Math.random().toString(36).substr(2, 9),
            ...newItem, // Use the complete newItem with all fields
          } as HistoryItem,
          ...prev
        ].slice(0, MAX_HISTORY_ITEMS));
      }
    } else {
      // Fallback: local
      setSearchHistory(prev => [
        {
          id: Math.random().toString(36).substr(2, 9),
          ...newItem, // Use the complete newItem with all fields
        } as HistoryItem,
        ...prev
      ].slice(0, MAX_HISTORY_ITEMS));
    }
  }, [userId, isOnline, searchHistory]);

  // Remove an item from search history
  const removeFromHistory = useCallback(async (id: string) => {
    if (userId && isOnline) {
      const { error } = await supabase.from('searches').delete().eq('id', id).eq('user_id', userId);
      if (error) {
        console.error('Error removing from search history:', error);
      }
    }
    setSearchHistory(prev => prev.filter(item => item.id !== id));
  }, [userId, isOnline]);

  // Clear all search history
  const clearSearchHistory = useCallback(async () => {
    // Clear the local state immediately
    setSearchHistory([]);
    
    // Clear from SecureStore
    try {
      await SecureStore.deleteItemAsync(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing search history from local storage:', error);
    }
    
    // Clear from Supabase if online
    if (userId && isOnline) {
      const { error } = await supabase.from('searches').delete().eq('user_id', userId);
      if (error) {
        console.error('Error clearing search history from database:', error);
        throw error; // Re-throw so the calling code can handle the error
      }
    }
  }, [userId, isOnline]);

  // Manual refresh from Supabase
  const refreshFromSupabase = useCallback(async () => {
    console.log('🔄 Refreshing search history from Supabase...');
    if (userId && isOnline) {
      try {
        const { data, error } = await supabase
          .from('searches')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(MAX_HISTORY_ITEMS);
          
        if (error) {
          console.error('❌ Error refreshing search history:', error);
          return;
        }
        
        if (data && data.length > 0) {
          console.log(`✅ Refreshed ${data.length} search history items from Supabase`);
          setSearchHistory(data.map((row: any) => {
            // If we have complete data from the data column, use it
            if (row.data && typeof row.data === 'object') {
              return {
                id: row.id,
                timestamp: row.created_at,
                // Use all data from the data column (complete SearchResult object)
                ...row.data,
                // Ensure these core fields are always present from the individual columns
                query: row.query,
                searchType: row.search_type || 'sold',
              } as HistoryItem;
            } else {
              // Fallback to individual columns for older entries
              return {
                id: row.id,
                query: row.query,
                title: row.ai_keywords || row.title || '',
                itemId: row.item_id || '',
                timestamp: row.created_at,
                image: row.image_url || '',
                link: row.link || '',
                price: row.price,
                searchType: row.search_type || 'sold',
              } as HistoryItem;
            }
          }));
        } else {
          console.log('✅ No search history found in Supabase');
          setSearchHistory([]);
        }
      } catch (error) {
        console.error('❌ Error refreshing search history:', error);
      }
    } else {
      console.log('⚠️ Cannot refresh: user not logged in or offline');
    }
  }, [userId, isOnline]);

  return { 
    searchHistory, 
    isLoading,
    userId,
    addToHistory, 
    removeFromHistory, 
    clearSearchHistory, 
    refreshFromSupabase
  };
}