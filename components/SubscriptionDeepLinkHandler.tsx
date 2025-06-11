import { useEffect } from 'react';
import { Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';

export default function SubscriptionDeepLinkHandler() {
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
  }, []);

  const handleDeepLink = async (url: string) => {
    console.log('🔗 Processing subscription deep link:', url);
    
    // Parse the URL
    const parsedUrl = Linking.parse(url);
    console.log('📋 Parsed URL:', parsedUrl);

    // Check if this is a subscription callback
    if (parsedUrl.hostname === 'subscription') {
      if (parsedUrl.path === 'success') {
        console.log('✅ Subscription success callback detected');
        
        const tier = parsedUrl.queryParams?.tier as string;
        const billing = parsedUrl.queryParams?.billing as string;
        
        // Navigate to subscription tab
        router.push('/(tabs)/subscription');
        
        // Show success message - removed refreshSubscription dependency
        setTimeout(() => {
          Alert.alert(
            '🎉 Payment Successful!',
            tier ? `Your ${tier} subscription is now active!` : 'Your subscription has been updated!',
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