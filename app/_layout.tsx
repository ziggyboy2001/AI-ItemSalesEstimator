import React, { useCallback, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { useThemeColor } from '@/constants/useThemeColor';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import AuthScreen from './AuthScreen';
import { useAuth } from '@/hooks/useAuth';
import { View, ActivityIndicator } from 'react-native';

// Keep the splash screen visible until fonts are loaded
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const backgroundColor = useThemeColor('background');
  const tintColor = useThemeColor('tint');
  const { user, isLoading, isInitialized } = useAuth();

  // Show loading while initializing auth or fonts
  if (!isInitialized || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor }}>
        <ActivityIndicator size="large" color={tintColor} />
      </View>
    );
  }

  // Show auth screen if no user
  if (!user) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor }}>
        <AuthScreen />
        <StatusBar style="auto" />
      </GestureHandlerRootView>
    );
  }

  // Show main app if authenticated
  return (
    <SubscriptionProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
          <Stack.Screen name="item/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="account-settings" options={{ presentation: 'modal', animation: 'slide_from_right' }} />
        </Stack>
        <StatusBar style="auto" />
      </GestureHandlerRootView>
    </SubscriptionProvider>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}