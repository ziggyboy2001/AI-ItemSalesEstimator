import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ExternalLink, Unlink, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useThemeColor } from '@/constants/useThemeColor';
import { 
  checkEbayConnection, 
  generateEbayAuthUrl, 
  disconnectEbayAccount 
} from '@/services/ebayIntegrationService';
import { supabase } from '@/services/supabaseClient';
import * as Linking from 'expo-linking';

interface EbayConnectionCardProps {
  userId: string;
  onConnectionChange?: (connected: boolean) => void;
}

export default function EbayConnectionCard({ userId, onConnectionChange }: EbayConnectionCardProps) {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState<string>();
  const [expiresAt, setExpiresAt] = useState<string>();

  // Theme colors
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const subtleText = useThemeColor('tabIconDefault');
  const tintColor = useThemeColor('tint');
  const errorColor = useThemeColor('error');
  const successColor = useThemeColor('success');
  const cardColor = useThemeColor('background');

  useEffect(() => {
    checkConnection();
  }, [userId]);

  // Listen for URL events to handle OAuth completion
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const url = event.url;
      console.log('🔗 EbayConnectionCard received URL:', url);
      
      // Check if this is an eBay OAuth callback
      if (url.includes('bidpeek://oauth/')) {
        console.log('✅ OAuth callback detected, refreshing connection...');
        setConnecting(false);
        
        // Small delay to allow the OAuth handler to process first
        setTimeout(() => {
          checkConnection();
        }, 1000);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription?.remove();
  }, []);

  const checkConnection = async () => {
    try {
      setLoading(true);
      const status = await checkEbayConnection(userId);
      setConnected(status.connected);
      setUsername(status.username);
      setExpiresAt(status.expiresAt);
      onConnectionChange?.(status.connected);
    } catch (error) {
      console.error('Error checking eBay connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      
      // Generate OAuth URL
      const authUrl = generateEbayAuthUrl(userId);
      
      console.log('🔗 Opening eBay OAuth URL:', authUrl);
      
      // Open URL in browser
      const supported = await Linking.canOpenURL(authUrl);
      if (supported) {
        await Linking.openURL(authUrl);
        
        // No need for manual confirmation - the OAuth handler will automatically detect the callback
        console.log('✅ OAuth URL opened, waiting for callback...');
      } else {
        throw new Error('Cannot open eBay authorization URL');
      }
    } catch (error) {
      console.error('Error connecting to eBay:', error);
      Alert.alert('Error', 'Failed to connect to eBay. Please try again.');
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect eBay Account',
      'Are you sure you want to disconnect your eBay account? You will no longer be able to list items until you reconnect.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectEbayAccount(userId);
              setConnected(false);
              setUsername(undefined);
              setExpiresAt(undefined);
              onConnectionChange?.(false);
              Alert.alert('Success', 'eBay account disconnected successfully');
            } catch (error) {
              console.error('Error disconnecting eBay:', error);
              Alert.alert('Error', 'Failed to disconnect eBay account');
            }
          }
        }
      ]
    );
  };

  const formatExpiryDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <Animated.View 
        style={[styles.container, { backgroundColor: 'rgba(128, 128, 128, 0.1)' }]}
        entering={FadeInDown.duration(400)}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <ActivityIndicator size="small" color={tintColor} />
          </View>
          <View style={styles.content}>
            <Text style={[styles.title, { color: textColor }]}>eBay Integration</Text>
            <Text style={[styles.subtitle, { color: subtleText }]}>Checking connection...</Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View 
      style={[styles.container, { backgroundColor: 'rgba(128, 128, 128, 0.1)' }]}
      entering={FadeInDown.duration(400)}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: connected ? successColor + '20' : subtleText + '20' }]}>
          {connected ? (
            <CheckCircle size={24} color={successColor} />
          ) : (
            <AlertCircle size={24} color={subtleText} />
          )}
        </View>
        
        <View style={styles.content}>
          <Text style={[styles.title, { color: textColor }]}>eBay Integration</Text>
          {connected ? (
            <View>
              <Text style={[styles.subtitle, { color: successColor }]}>
                Connected as @{username}
              </Text>
              {expiresAt && (
                <Text style={[styles.expiryText, { color: subtleText }]}>
                  Token expires: {formatExpiryDate(expiresAt)}
                </Text>
              )}
            </View>
          ) : (
            <Text style={[styles.subtitle, { color: subtleText }]}>
              Connect your eBay account to list items
            </Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        {connected ? (
          <TouchableOpacity
            style={[styles.button, styles.disconnectButton, { borderColor: errorColor }]}
            onPress={handleDisconnect}
          >
            <Unlink size={18} color={errorColor} />
            <Text style={[styles.buttonText, { color: errorColor }]}>Disconnect</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.connectButton, { backgroundColor: backgroundColor, borderColor: tintColor, borderWidth: 1, opacity: connecting ? 0.6 : 1 }]}
            onPress={handleConnect}
            disabled={connecting}
          >
            {connecting ? (
              <ActivityIndicator size="small" color={tintColor} />
            ) : (
              <ExternalLink size={18} color={tintColor} />
            )}
            <Text style={[styles.buttonText, { color: tintColor }]}>
              {connecting ? 'Connecting...' : 'Connect eBay'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {connected && (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: subtleText }]}>
            You can now list items from your hauls directly to eBay
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  expiryText: {
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    marginTop: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  connectButton: {
    // backgroundColor set via style prop
  },
  disconnectButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
}); 