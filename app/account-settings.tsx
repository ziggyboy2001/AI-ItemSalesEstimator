import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useThemeColor } from '@/constants/useThemeColor';
import { supabase } from '@/services/supabaseClient';
import EbayConnectionCard from '@/components/EbayConnectionCard';

export default function AccountSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Theme colors
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const subtleText = useThemeColor('tabIconDefault');
  const borderColor = useThemeColor('tabIconDefault');
  const tintColor = useThemeColor('tint');
  const errorColor = useThemeColor('error');
  const cardColor = useThemeColor('background');

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentEmail(user.email || '');
      setNewEmail(user.email || '');
      setUserId(user.id);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === currentEmail) {
      Alert.alert('Error', 'Please enter a new email address');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      
      Alert.alert(
        'Email Update Requested', 
        'Please check both your current and new email for confirmation links to complete the update.'
      );
      setCurrentEmail(newEmail);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      // First verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword
      });
      
      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      Alert.alert('Success', 'Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>{title}</Text>
      <View style={[styles.sectionContent, { backgroundColor: 'rgba(128, 128, 128, 0.1)' }]}>
        {children}
      </View>
    </View>
  );

  const renderInputField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    secureTextEntry: boolean = false,
    showPassword?: boolean,
    onTogglePassword?: () => void,
    keyboardType: 'default' | 'email-address' = 'default'
  ) => (
    <View style={styles.inputContainer}>
      <Text style={[styles.inputLabel, { color: textColor }]}>{label}</Text>
      <View style={[styles.inputWrapper, { borderColor: borderColor + '40' }]}>
        <TextInput
          style={[styles.input, { color: textColor }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={subtleText}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize="none"
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={onTogglePassword} style={styles.eyeIcon}>
            {showPassword ? (
              <EyeOff size={20} color={subtleText} />
            ) : (
              <Eye size={20} color={subtleText} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor }]}>
      {/* Header */}
      <Animated.View 
        style={styles.header}
        entering={FadeInDown.delay(100).duration(400)}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: textColor }]}>Account Settings</Text>
        <View style={{ width: 24 }} />
      </Animated.View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 32 }}>
        <Animated.View 
          style={styles.content}
          entering={FadeInDown.delay(200).duration(400)}
        >
          {/* Email Section */}
          {renderSection(
            'Email Address',
            <View>
              {renderInputField(
                'Current Email',
                currentEmail,
                () => {},
                'Enter your current email',
                false,
                undefined,
                undefined,
                'email-address'
              )}
              {renderInputField(
                'New Email',
                newEmail,
                setNewEmail,
                'Enter new email address',
                false,
                undefined,
                undefined,
                'email-address'
              )}
              <TouchableOpacity
                style={[styles.button, { backgroundColor: backgroundColor, opacity: loading ? 0.6 : 1, borderColor: tintColor, borderWidth: 1 }]}
                onPress={handleUpdateEmail}
                disabled={loading}
              >
                <Mail size={20} color={tintColor} style={{ marginRight: 8 }} />
                <Text style={[styles.buttonText, { color: tintColor }]}>
                  {loading ? 'Updating...' : 'Update Email'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Password Section */}
          {renderSection(
            'Change Password',
            <View>
              {renderInputField(
                'Current Password',
                currentPassword,
                setCurrentPassword,
                'Enter current password',
                true,
                showCurrentPassword,
                () => setShowCurrentPassword(!showCurrentPassword)
              )}
              {renderInputField(
                'New Password',
                newPassword,
                setNewPassword,
                'Enter new password',
                true,
                showNewPassword,
                () => setShowNewPassword(!showNewPassword)
              )}
              {renderInputField(
                'Confirm New Password',
                confirmPassword,
                setConfirmPassword,
                'Confirm new password',
                true,
                showConfirmPassword,
                () => setShowConfirmPassword(!showConfirmPassword)
              )}
              <TouchableOpacity
                style={[styles.button, { backgroundColor: backgroundColor, opacity: loading ? 0.6 : 1, borderColor: tintColor, borderWidth: 1 }]}
                onPress={handleUpdatePassword}
                disabled={loading}
              >
                <Lock size={20} color={tintColor} style={{ marginRight: 8 }} />
                <Text style={[styles.buttonText, { color: tintColor }]}>
                  {loading ? 'Updating...' : 'Update Password'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* eBay Integration Section */}
          {userId && (
            <Animated.View entering={FadeInDown.delay(400).duration(400)}>
              <EbayConnectionCard userId={userId} />
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    marginBottom: 12,
  },
  sectionContent: {
    borderRadius: 12,
    padding: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    paddingVertical: 12,
  },
  eyeIcon: {
    padding: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
}); 