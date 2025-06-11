import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { handleEbayOAuthCallback } from '@/services/ebayIntegrationService';

interface EbayOAuthHandlerProps {
  userId?: string;
  onAuthComplete?: (success: boolean, username?: string) => void;
}

export default function EbayOAuthHandler({ userId, onAuthComplete }: EbayOAuthHandlerProps) {
  const router = useRouter();

  useEffect(() => {
    // Handle initial URL if app was opened via deep link
    const handleInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('📱 App opened with initial URL:', initialUrl);
        await handleDeepLink(initialUrl);
      }
    };

    // Handle URLs while app is running
    const handleUrl = (event: { url: string }) => {
      console.log('📱 Received deep link:', event.url);
      handleDeepLink(event.url);
    };

    // Set up listeners
    handleInitialURL();
    const subscription = Linking.addEventListener('url', handleUrl);

    return () => {
      subscription?.remove();
    };
  }, [userId]);

  const handleDeepLink = async (url: string) => {
    console.log('🔗 Processing deep link:', url);
    
    // Parse the URL
    const parsedUrl = Linking.parse(url);
    console.log('📋 Parsed URL:', parsedUrl);

    // Check if this is an eBay OAuth callback
    if (parsedUrl.hostname === 'oauth' && parsedUrl.path === 'success') {
      console.log('✅ eBay OAuth success callback detected');
      
      // Prevent navigation to non-existent screen
      console.log('🔄 Preventing navigation, staying on current screen');
      
      // Extract authorization code from query parameters
      const authCode = parsedUrl.queryParams?.code as string;
      const state = parsedUrl.queryParams?.state as string;
      const error = parsedUrl.queryParams?.error as string;

      if (error) {
        console.error('❌ OAuth error:', error);
        Alert.alert(
          'eBay Authorization Failed',
          'eBay authorization was declined or failed. Please try again.',
          [{ text: 'OK' }]
        );
        onAuthComplete?.(false);
        return;
      }

      if (!authCode) {
        console.error('❌ No authorization code received');
        Alert.alert(
          'eBay Authorization Error',
          'No authorization code was received from eBay. Please try again.',
          [{ text: 'OK' }]
        );
        onAuthComplete?.(false);
        return;
      }

      if (!userId) {
        console.error('❌ No user ID available for OAuth callback');
        Alert.alert(
          'Authentication Error',
          'User not logged in. Please log in and try again.',
          [{ text: 'OK' }]
        );
        onAuthComplete?.(false);
        return;
      }

      console.log('🔄 Processing OAuth callback with auth code');
      console.log('📝 Auth code length:', authCode.length);
      console.log('👤 User ID:', userId);
      console.log('🔢 State:', state);
      
      try {
        // Handle the OAuth callback
        console.log('🚀 Calling handleEbayOAuthCallback...');
        const result = await handleEbayOAuthCallback(userId, authCode);
        console.log('📊 OAuth callback result:', result);
        
        if (result.success) {
          console.log('✅ eBay OAuth completed successfully');
          Alert.alert(
            'eBay Connected!',
            `Successfully connected to eBay as @${result.ebayUsername}`,
            [{ text: 'Great!' }]
          );
          onAuthComplete?.(true, result.ebayUsername);
        } else {
          console.error('❌ OAuth callback processing failed');
          Alert.alert(
            'eBay Connection Failed',
            'Failed to complete eBay connection. Please try again.',
            [{ text: 'OK' }]
          );
          onAuthComplete?.(false);
        }
      } catch (error) {
        console.error('💥 Error processing OAuth callback:', error);
        Alert.alert(
          'eBay Connection Error',
          'An error occurred while connecting to eBay. Please try again.',
          [{ text: 'OK' }]
        );
        onAuthComplete?.(false);
      }
    } else if (parsedUrl.hostname === 'oauth' && parsedUrl.path === 'declined') {
      console.log('❌ eBay OAuth declined callback detected');
      Alert.alert(
        'eBay Authorization Cancelled',
        'eBay authorization was cancelled. You can try again anytime.',
        [{ text: 'OK' }]
      );
      onAuthComplete?.(false);
    }
  };

  // This is a utility component, it doesn't render anything
  return null;
} 