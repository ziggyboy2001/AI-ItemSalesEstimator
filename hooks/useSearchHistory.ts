import { useState, useCallback, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const SEARCH_HISTORY_KEY = 'searchHistory';
const MAX_HISTORY_ITEMS = 50;

interface HistoryItem {
  id: number;
  itemId: string;
  query: string;
  title: string;
  timestamp: string;
  [key: string]: any;
}

export function useSearchHistory() {
  const [searchHistory, setSearchHistory] = useState<HistoryItem[]>([]);

  // Load search history on mount
  useEffect(() => {
    const loadSearchHistory = async () => {
      try {
        const savedHistory = await SecureStore.getItemAsync(SEARCH_HISTORY_KEY);
        if (savedHistory) {
          setSearchHistory(JSON.parse(savedHistory));
        }
      } catch (error) {
        console.error('Error loading search history:', error);
      }
    };

    loadSearchHistory();
  }, []);

  // Save search history when it changes
  useEffect(() => {
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
  }, [searchHistory]);

  // Add an item to search history
  const addToHistory = useCallback((item: HistoryItem) => {
    if (!item.itemId || !item.query) return;
    
    setSearchHistory(prevHistory => {
      // Check if this itemId already exists
      const existingIndex = prevHistory.findIndex(h => h.itemId === item.itemId);
      
      if (existingIndex >= 0) {
        // Update the existing item with the new timestamp
        const updatedHistory = [...prevHistory];
        updatedHistory[existingIndex] = {
          ...updatedHistory[existingIndex],
          ...item,
          timestamp: new Date().toISOString()
        };
        return updatedHistory;
      } else {
        // Add the new item to the beginning
        return [item, ...prevHistory].slice(0, MAX_HISTORY_ITEMS);
      }
    });
  }, []);

  // Remove an item from search history
  const removeFromHistory = useCallback((id: number) => {
    setSearchHistory(prevHistory => 
      prevHistory.filter(item => item.id !== id)
    );
  }, []);

  // Clear all search history
  const clearSearchHistory = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(SEARCH_HISTORY_KEY);
      setSearchHistory([]);
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  }, []);

  return { 
    searchHistory, 
    addToHistory, 
    removeFromHistory, 
    clearSearchHistory 
  };
}