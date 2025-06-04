import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Image, TouchableOpacity, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useThemeColor } from '@/constants/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '@/hooks/useAuth';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  // Use our custom auth hook
  const { signIn, signUp, authenticateWithBiometrics, getStoredEmail } = useAuth();

  // Theme colors
  const background = useThemeColor('background');
  const text = useThemeColor('text');
  const tint = useThemeColor('tint');
  const error = useThemeColor('error');
  const border = useThemeColor('tabIconDefault');

  useEffect(() => {
    checkBiometricsAndLoadEmail();
  }, []);

  const checkBiometricsAndLoadEmail = async () => {
    try {
      console.log('Checking biometrics availability...');
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      console.log('Biometrics status:', { compatible, enrolled });
      setBiometricsAvailable(compatible && enrolled);

      // Load stored email
      const storedEmail = await getStoredEmail();
      if (storedEmail) {
        setEmail(storedEmail);
      }
    } catch (error) {
      console.error('Error in checkBiometricsAndLoadEmail:', error);
    }
  };

  const handleBiometricAuth = async () => {
    console.log('handleBiometricAuth called');
    setLoading(true);
    try {
      const success = await authenticateWithBiometrics();
      if (!success) {
        Alert.alert('Authentication Failed', 'Could not authenticate with biometrics');
      }
      // If successful, the auth state will update automatically
    } catch (error) {
      console.error('Biometric auth error:', error);
      Alert.alert('Error', 'Failed to authenticate with biometrics');
    } finally {
      setLoading(false);
    }
  };

  const passwordsMatch = !isSignUp || password === confirmPassword;

  const handleAuth = async () => {
    if (isSignUp && !passwordsMatch) {
      Alert.alert('Hold up!', 'These passwords do not match');
      return;
    }
    
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Information', 'Please enter both email and password');
      return;
    }
    
    setLoading(true);
    try {
      let result;
      if (isSignUp) {
        result = await signUp(email, password);
      } else {
        result = await signIn(email, password);
      }
      
      if (!result.success) {
        Alert.alert('Authentication Error', result.error || 'An error occurred');
      } else {
        // Check if device supports biometrics and offer to enable it
        if (!isSignUp) {
          const compatible = await LocalAuthentication.hasHardwareAsync();
          const enrolled = await LocalAuthentication.isEnrolledAsync();
          
          if (compatible && enrolled) {
            setTimeout(() => {
              Alert.alert(
                'Enable Biometric Login?',
                `Would you like to use ${Platform.OS === 'ios' ? 'Face ID/Touch ID' : 'fingerprint'} to log in next time?`,
                [
                  { text: 'Not Now', style: 'cancel' },
                  { 
                    text: 'Enable', 
                    onPress: async () => {
                      try {
                        // Test biometrics before confirming
                        const result = await LocalAuthentication.authenticateAsync({
                          promptMessage: 'Verify to enable biometric login',
                          fallbackLabel: 'Use password',
                          cancelLabel: 'Cancel',
                          disableDeviceFallback: false,
                        });

                        if (result.success) {
                          console.log('Biometrics enabled successfully');
                        }
                      } catch (error) {
                        console.error('Error enabling biometrics:', error);
                      }
                    }
                  }
                ]
              );
            }, 500);
          }
        }
        
        Alert.alert('Success', isSignUp ? 'Account created! Check your email for confirmation.' : 'Welcome back!');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: background }]}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Image 
          source={require('@/assets/images/bidPeekLogoText.png')} 
          style={{ width: 200, height: 200, resizeMode: 'contain' }} 
        />
        <Text style={[styles.title, { color: text }]}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
        
        {biometricsAvailable && !isSignUp && (
          <TouchableOpacity
            style={[styles.biometricButton, { borderColor: tint }]}
            onPress={() => {
              console.log('Biometric button pressed');
              handleBiometricAuth();
            }}
          >
            <Ionicons 
              name={Platform.OS === 'ios' ? 'finger-print' : 'finger-print'} 
              size={24} 
              color={tint} 
            />
            <Text style={[styles.biometricText, { color: tint }]}>
              Sign in with {Platform.OS === 'ios' ? 'Face ID' : 'fingerprint'}
            </Text>
          </TouchableOpacity>
        )}

        <TextInput
          style={[styles.input, { color: text, borderColor: border }]}
          placeholder="Email"
          placeholderTextColor={border}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        
        <View style={styles.passwordContainer}>
          <TextInput
            style={[
              styles.input,
              { color: text, borderColor: border },
              styles.passwordInput
            ]}
            placeholder="Password"
            placeholderTextColor={border}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity 
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons 
              name={showPassword ? "eye-off" : "eye"} 
              size={24} 
              color={border} 
            />
          </TouchableOpacity>
        </View>
        
        {isSignUp && (
          <TextInput
            style={[
              styles.input,
              { color: text, borderColor: passwordsMatch ? border : error }
            ]}
            placeholder="Confirm Password"
            placeholderTextColor={border}
            secureTextEntry={!showPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        )}
        
        <TouchableOpacity
          style={[styles.authButton, { backgroundColor: background, borderColor: tint, borderWidth: 1 }]}
          onPress={handleAuth}
          disabled={loading}
        >
          <Text style={[styles.authButtonText, { color: tint }]}>
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <Text
          style={[styles.toggle, { color: tint }]}
          onPress={() => {
            setIsSignUp((prev) => !prev);
            setConfirmPassword('');
          }}
        >
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  passwordContainer: {
    width: '100%',
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  toggle: {
    marginTop: 16,
    textDecorationLine: 'underline',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    width: '100%',
  },
  biometricText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  authButton: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});