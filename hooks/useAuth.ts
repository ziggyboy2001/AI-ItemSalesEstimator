import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabaseClient';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import type { User, Session } from '@supabase/supabase-js';

const TOKEN_KEY = 'bidpeek_auth_token';
const REFRESH_TOKEN_KEY = 'bidpeek_refresh_token';
const LAST_EMAIL_KEY = 'bidpeek_last_email';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Store tokens securely
  const storeTokens = useCallback(async (session: Session) => {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, session.access_token);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refresh_token);
      console.log('Tokens stored securely');
    } catch (error) {
      console.error('Error storing tokens:', error);
    }
  }, []);

  // Clear stored tokens
  const clearTokens = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      console.log('Tokens cleared');
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }, []);

  // Try to restore session from stored tokens
  const restoreSession = useCallback(async () => {
    try {
      console.log('Attempting to restore session from stored tokens...');
      
      const accessToken = await SecureStore.getItemAsync(TOKEN_KEY);
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

      if (accessToken && refreshToken) {
        console.log('Found stored tokens, attempting to set session...');
        
        // Set the session with stored tokens
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Error restoring session:', error);
          // Clear invalid tokens
          await clearTokens();
          return false;
        }

        if (data.session && data.user) {
          console.log('Session restored successfully');
          setSession(data.session);
          setUser(data.user);
          return true;
        }
      }

      console.log('No valid stored tokens found');
      return false;
    } catch (error) {
      console.error('Error in restoreSession:', error);
      await clearTokens();
      return false;
    }
  }, [clearTokens]);

  // Biometric authentication
  const authenticateWithBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!compatible || !enrolled) {
        console.log('Biometrics not available or not enrolled');
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Use biometrics to sign in',
        disableDeviceFallback: true,
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        console.log('Biometric authentication successful');
        return await restoreSession();
      }

      console.log('Biometric authentication failed or cancelled');
      return false;
    } catch (error) {
      console.error('Error in biometric authentication:', error);
      return false;
    }
  }, [restoreSession]);

  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.session) {
        await storeTokens(data.session);
        await SecureStore.setItemAsync(LAST_EMAIL_KEY, email);
        setSession(data.session);
        setUser(data.user);
        console.log('Sign in successful');
        return { success: true };
      }

      return { success: false, error: 'No session returned' };
    } catch (error) {
      console.error('Error in signIn:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      setIsLoading(false);
    }
  }, [storeTokens]);

  // Sign up with email/password
  const signUp = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.session) {
        await storeTokens(data.session);
        await SecureStore.setItemAsync(LAST_EMAIL_KEY, email);
        setSession(data.session);
        setUser(data.user);
      }

      return { success: true };
    } catch (error) {
      console.error('Error in signUp:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      setIsLoading(false);
    }
  }, [storeTokens]);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      await clearTokens();
      setSession(null);
      setUser(null);
      console.log('Sign out successful');
    } catch (error) {
      console.error('Error in signOut:', error);
    } finally {
      setIsLoading(false);
    }
  }, [clearTokens]);

  // Get stored email for convenience
  const getStoredEmail = useCallback(async (): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(LAST_EMAIL_KEY);
    } catch (error) {
      console.error('Error getting stored email:', error);
      return null;
    }
  }, []);

  // Initialize authentication
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      console.log('Initializing authentication...');
      
      try {
        // First, try to restore from stored tokens
        const restored = await restoreSession();
        
        if (!restored) {
          // If restoration failed, check current session
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Error getting current session:', error);
          } else if (session && session.user) {
            console.log('Found existing session');
            await storeTokens(session);
            if (mounted) {
              setSession(session);
              setUser(session.user);
            }
          } else {
            console.log('No existing session found');
          }
        }
      } catch (error) {
        console.error('Error in initializeAuth:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        await clearTokens();
        setUser(null);
        setSession(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          await storeTokens(session);
          setSession(session);
          setUser(session.user);
        }
      }
    });

    initializeAuth();

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, [restoreSession, storeTokens, clearTokens]);

  return {
    user,
    session,
    isLoading,
    isInitialized,
    signIn,
    signUp,
    signOut,
    authenticateWithBiometrics,
    getStoredEmail,
  };
} 