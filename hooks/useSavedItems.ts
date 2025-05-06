import { useState, useCallback, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const SAVED_ITEMS_KEY = 'savedItems';

export function useSavedItems() {
  const [savedItems, setSavedItems] = useState<any[]>([]);

  // Load saved items on mount
  useEffect(() => {
    const loadSavedItems = async () => {
      try {
        const items = await SecureStore.getItemAsync(SAVED_ITEMS_KEY);
        if (items) {
          setSavedItems(JSON.parse(items));
        }
      } catch (error) {
        console.error('Error loading saved items:', error);
      }
    };

    loadSavedItems();
  }, []);

  // Save items when they change
  useEffect(() => {
    const saveSavedItems = async () => {
      try {
        await SecureStore.setItemAsync(SAVED_ITEMS_KEY, JSON.stringify(savedItems));
      } catch (error) {
        console.error('Error saving items:', error);
      }
    };

    saveSavedItems();
  }, [savedItems]);

  // Add an item to saved items
  const addToSaved = useCallback((item: any) => {
    if (!item || !item.itemId) return;
    
    setSavedItems(prevItems => {
      // Check if this item already exists
      if (prevItems.some(i => i.itemId === item.itemId)) {
        return prevItems;
      }
      
      // Add the new item
      return [
        {
          ...item,
          savedAt: new Date().toISOString()
        }, 
        ...prevItems
      ];
    });
  }, []);

  // Remove an item from saved items
  const removeFromSaved = useCallback((itemId: string) => {
    setSavedItems(prevItems => 
      prevItems.filter(item => item.itemId !== itemId)
    );
  }, []);

  // Clear all saved items
  const clearSavedItems = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(SAVED_ITEMS_KEY);
      setSavedItems([]);
    } catch (error) {
      console.error('Error clearing saved items:', error);
    }
  }, []);

  return { 
    savedItems, 
    addToSaved, 
    removeFromSaved, 
    clearSavedItems 
  };
}