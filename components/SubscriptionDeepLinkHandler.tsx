import { useEffect } from 'react';
import { Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSubscription } from '@/contexts/SubscriptionContext';

export default function SubscriptionDeepLinkHandler() {
  const router = useRouter();
  const { refreshSubscription } = useSubscription();

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
  }, []);

  const parseDeepLink = (url: string) => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const path = urlObj.pathname.replace(/^\//, ''); // Remove leading slash
      
      // Parse query parameters
      const queryParams: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });

      return {
        hostname,
        path,
        queryParams
      };
    } catch (error) {
      console.error('❌ Error parsing deep link URL:', error);
      return null;
    }
  };

  const handleDeepLink = async (url: string) => {
    console.log('🔗 Processing subscription deep link:', url);
    
    // Parse the URL manually
    const parsedUrl = parseDeepLink(url);
    if (!parsedUrl) {
      console.error('❌ Failed to parse deep link URL');
      return;
    }
    
    console.log('📋 Parsed URL:', parsedUrl);

    // Check if this is a subscription callback
    if (parsedUrl.hostname === 'subscription') {
      if (parsedUrl.path === 'success') {
        console.log('✅ Subscription success callback detected');
        
        const tier = parsedUrl.queryParams?.tier as string;
        const billing = parsedUrl.queryParams?.billing as string;
        const packId = parsedUrl.queryParams?.packId as string;
        
        // Refresh subscription data from backend
        try {
          await refreshSubscription();
          console.log('🔄 Subscription data refreshed after payment');
        } catch (error) {
          console.error('❌ Failed to refresh subscription after payment:', error);
        }
        
        // Navigate to subscription tab
        router.push('/(tabs)/subscription');
        
        // Show success message
        setTimeout(() => {
          let message = 'Your subscription has been updated!';
          if (tier) {
            message = `Your ${tier} subscription is now active!`;
          } else if (packId) {
            message = 'Your scan pack has been added to your account!';
          }
          
          Alert.alert(
            '🎉 Payment Successful!',
            message,
            [{ text: 'Awesome!', style: 'default' }]
          );
        }, 500);
        
      } else if (parsedUrl.path === 'cancel') {
        console.log('❌ Subscription cancel callback detected');
        
        // Navigate to subscription tab
        router.push('/(tabs)/subscription');
        
        // Show cancel message
        setTimeout(() => {
          Alert.alert(
            'Payment Cancelled',
            'No worries! You can try again anytime.',
            [{ text: 'OK' }]
          );
        }, 500);
      }
    }
  };

  // This is a utility component, it doesn't render anything
  return null;
} 