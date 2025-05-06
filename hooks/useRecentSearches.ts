import { useState, useCallback, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const RECENT_SEARCHES_KEY = 'recentSearches';
const MAX_RECENT_SEARCHES = 10;

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches on mount
  useEffect(() => {
    const loadRecentSearches = async () => {
      try {
        const savedSearches = await SecureStore.getItemAsync(RECENT_SEARCHES_KEY);
        if (savedSearches) {
          setRecentSearches(JSON.parse(savedSearches));
        }
      } catch (error) {
        console.error('Error loading recent searches:', error);
      }
    };

    loadRecentSearches();
  }, []);

  // Save recent searches when they change
  useEffect(() => {
    const saveRecentSearches = async () => {
      try {
        await SecureStore.setItemAsync(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches));
      } catch (error) {
        console.error('Error saving recent searches:', error);
      }
    };

    if (recentSearches.length > 0) {
      saveRecentSearches();
    }
  }, [recentSearches]);

  // Add a search to recent searches
  const addRecentSearch = useCallback((search: string) => {
    if (!search.trim()) return;
    
    setRecentSearches(prevSearches => {
      // Remove the search if it already exists
      const filteredSearches = prevSearches.filter(s => s !== search);
      
      // Add the new search to the beginning
      return [search, ...filteredSearches].slice(0, MAX_RECENT_SEARCHES);
    });
  }, []);

  // Clear all recent searches
  const clearRecentSearches = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(RECENT_SEARCHES_KEY);
      setRecentSearches([]);
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  }, []);

  return { recentSearches, addRecentSearch, clearRecentSearches };
}