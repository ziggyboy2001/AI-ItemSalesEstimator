import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text } from 'react-native';

export default function OAuthSuccess() {
  const router = useRouter();

  useEffect(() => {
    // Immediately go back to the previous screen
    console.log('📱 OAuth success route hit, going back...');
    router.back();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Completing eBay connection...</Text>
    </View>
  );
} 