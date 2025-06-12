import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text } from 'react-native';

export default function OAuthCatchAll() {
  const router = useRouter();

  useEffect(() => {
    console.log('📱 OAuth catch-all route hit, going back immediately...');
    // Use replace to avoid adding to navigation stack
    router.replace('/(tabs)/account');
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <Text style={{ color: '#fff' }}>Completing eBay connection...</Text>
    </View>
  );
} 