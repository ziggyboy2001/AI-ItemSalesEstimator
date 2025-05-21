import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { useThemeColor } from '@/constants/useThemeColor';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // Theme colors
  const background = useThemeColor('background');
  const text = useThemeColor('text');
  const tint = useThemeColor('tint');
  const error = useThemeColor('error');
  const border = useThemeColor('tabIconDefault');

  const handleAuth = async () => {
    setLoading(true);
    try {
      let result;
      if (isSignUp) {
        result = await supabase.auth.signUp({ email, password });
      } else {
        result = await supabase.auth.signInWithPassword({ email, password });
      }
      if (result.error) {
        Alert.alert('Auth Error', result.error.message);
      } else {
        Alert.alert('Success', isSignUp ? 'Check your email for confirmation.' : 'Signed in!');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <Text style={[styles.title, { color: text }]}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
      <TextInput
        style={[styles.input, { color: text, borderColor: border }]}
        placeholder="Email"
        placeholderTextColor={border}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={[styles.input, { color: text, borderColor: border }]}
        placeholder="Password"
        placeholderTextColor={border}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button
        color={tint}
        title={loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
        onPress={handleAuth}
        disabled={loading}
      />
      <Text
        style={[styles.toggle, { color: tint }]}
        onPress={() => setIsSignUp((prev) => !prev)}
      >
        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  toggle: {
    marginTop: 16,
    textDecorationLine: 'underline',
  },
}); 