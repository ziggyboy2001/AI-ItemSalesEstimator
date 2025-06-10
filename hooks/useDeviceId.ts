import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'bidpeek_device_id';

/**
 * Hook to generate and persist a unique device identifier
 * This is used for anonymous scan tracking and subscription management
 */
export const useDeviceId = () => {
  const [deviceId, setDeviceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeDeviceId();
  }, []);

  const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const initializeDeviceId = async () => {
    try {
      // First try to get existing device ID
      const existingId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      
      if (existingId) {
        setDeviceId(existingId);
        setIsLoading(false);
        return;
      }

      // Generate new device ID using UUID
      const uniqueId = generateUUID();
      
      // Add prefix to identify it as a BidPeek device ID
      const deviceIdentifier = `bp_${uniqueId}`;
      
      // Store for future use
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceIdentifier);
      setDeviceId(deviceIdentifier);
      
      console.log('✅ Device ID generated:', deviceIdentifier.substring(0, 10) + '...');
      
    } catch (error) {
      console.error('Error with device ID:', error);
      // Fallback to timestamp-based ID
      const fallbackId = `bp_fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      try {
        await AsyncStorage.setItem(DEVICE_ID_KEY, fallbackId);
      } catch {
        // If storage fails, use session-only ID
      }
      setDeviceId(fallbackId);
    } finally {
      setIsLoading(false);
    }
  };

  const resetDeviceId = async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(DEVICE_ID_KEY);
      await initializeDeviceId();
    } catch (error) {
      console.error('Error resetting device ID:', error);
    }
  };

  return {
    deviceId,
    isLoading,
    resetDeviceId
  };
}; 