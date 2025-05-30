import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, Switch, ScrollView, Alert, Image, ActivityIndicator, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronRight, Info, Moon, User, Trash2, Bell, AlertTriangle } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { useThemeColor } from '@/constants/useThemeColor';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/services/supabaseClient';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { clearSearchHistory } = useSearchHistory();
  const { clearRecentSearches } = useRecentSearches();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const router = useRouter();

  // THEME COLORS
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const subtleText = useThemeColor('tabIconDefault');
  const borderColor = useThemeColor('tabIconDefault');
  const tintColor = useThemeColor('tint');
  const errorColor = useThemeColor('error');
  const cardColor = useThemeColor('background');

  useEffect(() => {
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      
      // Load notification preference
      const { data: settings } = await supabase
        .from('user_settings')
        .select('notifications')
        .eq('user_id', user.id)
        .single();
        
      if (settings) {
        setNotifications(settings.notifications || true);
      }
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    setNotifications(value);
    if (userId) {
      await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          notifications: value,
          dark_mode: isDarkMode,
          default_filters: {}
        });
    }
  };

  const handleClearSearchHistory = async () => {
    if (!userId) {
      Alert.alert("Error", "You must be signed in to clear search history");
      return;
    }

    Alert.alert(
      "Clear Search History",
      "This will permanently delete all your search history from both this device and our servers. This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Clear Search History",
          style: "destructive",
          onPress: async () => {
            try {
              // Use the hook's clearSearchHistory method which handles both database and local state
              await clearSearchHistory();
              clearRecentSearches();
              
              Alert.alert("Success", "Search history has been completely cleared from both this device and our servers");
            } catch (error) {
              console.error('Error clearing search history:', error);
              Alert.alert("Error", "Failed to clear search history. Please try again.");
            }
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    if (!userId) {
      Alert.alert("Error", "You must be signed in to delete your account");
      return;
    }

    Alert.alert(
      "⚠️ Delete Account & All Data",
      "This will permanently delete your account and ALL associated data:\n\n• Search history\n• Haul tracking data\n• User settings\n• Account profile\n\nThis action cannot be undone.\n\nWould you like to export your data first?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Export Data First",
          onPress: () => handleDataExport()
        },
        {
          text: "Delete Without Export",
          style: "destructive",
          onPress: () => confirmAccountDeletion()
        }
      ]
    );
  };

  const handleDataExport = async () => {
    if (!userId) {
      Alert.alert("Error", "You must be signed in to export your data");
      return;
    }

    try {
      Alert.alert("Exporting Data", "Preparing your data export...");
      
      // Fetch all user data from Supabase
      const [searchesResult, haulsResult, haulItemsResult, settingsResult] = await Promise.all([
        supabase.from('searches').select('*').eq('user_id', userId),
        supabase.from('hauls').select('*').eq('user_id', userId),
        supabase.from('haul_items').select('*').in('haul_id', 
          await supabase.from('hauls').select('id').eq('user_id', userId).then(res => res.data?.map(h => h.id) || [])
        ),
        supabase.from('user_settings').select('*').eq('user_id', userId).single()
      ]);

      // Compile data export
      const exportData = {
        exportDate: new Date().toISOString(),
        userId: userId,
        searches: searchesResult.data || [],
        hauls: haulsResult.data || [],
        haulItems: haulItemsResult.data || [],
        userSettings: settingsResult.data || {},
        summary: {
          totalSearches: searchesResult.data?.length || 0,
          totalHauls: haulsResult.data?.length || 0,
          totalHaulItems: haulItemsResult.data?.length || 0
        }
      };

      // Create a readable summary for the user
      const summary = `📊 Your BidPeek Data Export
Generated: ${new Date().toLocaleDateString()}

📈 Account Summary:
• Total Searches: ${exportData.summary.totalSearches}
• Hauls Created: ${exportData.summary.totalHauls}
• Items in Hauls: ${exportData.summary.totalHaulItems}

🔧 Settings:
• Dark Mode: ${settingsResult.data?.dark_mode ? 'Enabled' : 'Disabled'}
• Notifications: ${settingsResult.data?.notifications ? 'Enabled' : 'Disabled'}

📱 This data has been prepared for export. In a production app, this would be downloadable as a JSON file.`;

      Alert.alert(
        "📁 Data Export Ready",
        summary,
        [
          {
            text: "View Full Data",
            onPress: () => showFullDataExport(exportData)
          },
          {
            text: "Cancel Deletion",
            style: "cancel"
          },
          {
            text: "Export & Delete Account",
            style: "destructive",
            onPress: () => confirmAccountDeletion()
          }
        ]
      );

    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert(
        "Export Error",
        "Failed to export your data. Would you still like to delete your account?",
        [
          {
            text: "Cancel Deletion",
            style: "cancel"
          },
          {
            text: "Delete Without Export",
            style: "destructive", 
            onPress: () => confirmAccountDeletion()
          }
        ]
      );
    }
  };

  const showFullDataExport = (exportData: any) => {
    const dataText = JSON.stringify(exportData, null, 2);
    
    Alert.alert(
      "📄 Full Data Export",
      `Your complete data export is ready.\n\nData includes:\n• ${exportData.summary.totalSearches} searches\n• ${exportData.summary.totalHauls} hauls\n\nData size: ${(dataText.length / 1024).toFixed(1)} KB`,
      [
        {
          text: "Share Data File",
          onPress: async () => {
            try {
              const fileName = `BidPeek_Data_Export_${new Date().toISOString().split('T')[0]}.json`;
              
              await Share.share({
                message: `BidPeek Data Export\n\nGenerated: ${new Date().toLocaleDateString()}\n\nYour complete BidPeek account data:\n\n${dataText}`,
                title: fileName
              });
              
              // Also log to console for development
              console.log('=== USER DATA EXPORT ===');
              console.log('Export Date:', exportData.exportDate);
              console.log('Summary:', exportData.summary);
              console.log('Full Data:', dataText);
              console.log('=== END DATA EXPORT ===');
              
            } catch (error) {
              console.error('Share error:', error);
              Alert.alert(
                "Export Data", 
                "Your data has been prepared. Check the console logs for your complete data export."
              );
              console.log('=== USER DATA EXPORT (FALLBACK) ===');
              console.log(dataText);
              console.log('=== END DATA EXPORT ===');
            }
          }
        },
        {
          text: "Proceed with Deletion",
          style: "destructive",
          onPress: () => confirmAccountDeletion()
        },
        {
          text: "Cancel",
          style: "cancel"
        }
      ]
    );
  };

  const confirmAccountDeletion = () => {
    Alert.alert(
      "🚨 Final Confirmation",
      "You are about to permanently delete your account.\n\nThis will:\n✓ Delete all your search history\n✓ Delete all haul data\n✓ Remove your account completely\n\nThis action is irreversible.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Yes, Delete My Account",
          style: "destructive",
          onPress: () => performAccountDeletion()
        }
      ]
    );
  };

  const performAccountDeletion = async () => {
    if (!userId) {
      Alert.alert("Error", "No user found to delete");
      return;
    }

    setIsDeleting(true);
    
    try {
      // Clear local storage first
      clearSearchHistory();
      clearRecentSearches();

      // Call our Edge Function to delete the user account completely
      // This will handle both data deletion and auth user deletion
      const { data, error: functionError } = await supabase.functions.invoke('delete-user-account', {
        body: { userId }
      });

      if (functionError) {
        console.error('Error calling delete function:', functionError);
        
        // Provide more specific error messages
        let errorMessage = "There was an error deleting your account. ";
        
        if (functionError.message?.includes('not found')) {
          errorMessage += "Account not found. You may have already been signed out.";
        } else if (functionError.message?.includes('network')) {
          errorMessage += "Network error. Please check your connection and try again.";
        } else {
          errorMessage += "Please contact support for assistance.";
        }
        
        Alert.alert("Deletion Error", errorMessage);
        
        // Still clear local data and sign out as fallback
        await supabase.auth.signOut();
        router.replace('/(tabs)/');
        return;
      }

      // Verify the function succeeded
      if (!data?.success) {
        console.error('Delete function did not return success');
        Alert.alert(
          "Partial Deletion", 
          "Your data may have been partially deleted. Please contact support to ensure complete account removal."
        );
        await supabase.auth.signOut();
        router.replace('/(tabs)/');
        return;
      }

      // Account deletion was successful
      console.log('Account deletion completed successfully');
      
      // Sign out the user (though they should already be deleted)
      await supabase.auth.signOut();
      
      Alert.alert(
        "✅ Account Completely Deleted", 
        "Your account and all associated data have been permanently removed from our systems. Thank you for using BidPeek.", 
        [
          {
            text: "OK",
            onPress: () => {
              router.replace('/(tabs)/');
            }
          }
        ]
      );

    } catch (error) {
      console.error('Account deletion error:', error);
      Alert.alert(
        "Deletion Error", 
        "There was an error deleting your account. Please contact support or try again later."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const renderSectionHeader = (title: string) => (
    <Text style={[styles.sectionHeader, { color: subtleText }]}>{title}</Text>
  );

  interface SettingItemProps {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    action: () => void;
    isLast?: boolean;
  }

  const renderSettingItem = ({ icon, title, subtitle, action, isLast = false }: SettingItemProps) => (
    <TouchableOpacity
      style={[styles.settingItem, isLast && styles.lastSettingItem, { borderBottomColor: borderColor, backgroundColor: cardColor }]}
      onPress={action}
    >
      <View style={[styles.settingIcon, { backgroundColor: borderColor }]}>{icon}</View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: textColor }]}>{title}</Text>
        {subtitle && <Text style={[styles.settingSubtitle, { color: subtleText }]}>{subtitle}</Text>}
      </View>
      <ChevronRight size={20} color={subtleText} />
    </TouchableOpacity>
  );

  interface ToggleItemProps {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    isLast?: boolean;
  }

  const renderToggleItem = ({ icon, title, subtitle, value, onValueChange, isLast = false }: ToggleItemProps) => (
    <View style={[styles.settingItem, isLast && styles.lastSettingItem, { borderBottomColor: borderColor, backgroundColor: cardColor }] }>
      <View style={[styles.settingIcon, { backgroundColor: borderColor }]}>{icon}</View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: textColor }]}>{title}</Text>
        {subtitle && <Text style={[styles.settingSubtitle, { color: subtleText }]}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: borderColor, true: tintColor }}
        thumbColor={cardColor}
        ios_backgroundColor={borderColor}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor }]}> 
      <Animated.View 
        style={styles.header}
        entering={FadeInDown.delay(100).duration(400)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[styles.title, { color: textColor }]}>Settings</Text>
          <Image source={require('@/assets/images/iconVector.png')} style={{ width: 28, height: 28 }} />
        </View>
      </Animated.View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 32 }}>
        <Animated.View 
          style={styles.content}
          entering={FadeInDown.delay(200).duration(400)}
        >
          {renderSectionHeader('Appearance')}
          <View style={styles.settingsGroup}>
            {renderToggleItem({
              icon: <Moon size={20} color={tintColor} />,
              title: 'Dark Mode',
              subtitle: 'Switch between light and dark theme',
              value: isDarkMode,
              onValueChange: toggleDarkMode
            })}
            {renderToggleItem({
              icon: <Bell size={20} color={tintColor} />,
              title: 'Notifications',
              subtitle: 'Get alerts for price drops on saved items',
              value: notifications,
              onValueChange: handleNotificationToggle,
              isLast: true
            })}
          </View>

          {renderSectionHeader('Account')}
          <View style={styles.settingsGroup}>
            {renderSettingItem({
              icon: <User size={20} color={tintColor} />,
              title: 'Account Settings',
              subtitle: 'Manage your profile and preferences',
              action: () => router.push('/account-settings')
            })}
            {isDeleting ? (
              <View style={[styles.settingItem, styles.lastSettingItem, { borderBottomColor: borderColor, backgroundColor: cardColor, justifyContent: 'center' }]}>
                <ActivityIndicator size="small" color={errorColor} />
                <Text style={[styles.settingTitle, { color: errorColor, marginLeft: 12 }]}>Deleting account...</Text>
              </View>
            ) : (
              renderSettingItem({
                icon: <AlertTriangle size={20} color={errorColor} />,
                title: 'Delete Account and All Data',
                subtitle: 'Permanently delete your account and all associated data',
                action: handleDeleteAccount,
                isLast: true
              })
            )}
          </View>

          {renderSectionHeader('Data')}
          <View style={styles.settingsGroup}>
            {renderSettingItem({
              icon: <Trash2 size={20} color={errorColor} />,
              title: 'Clear Search History',
              subtitle: 'Erase search history from both this device and our servers',
              action: handleClearSearchHistory,
              isLast: true
            })}
          </View>

          {renderSectionHeader('About')}
          <View style={styles.settingsGroup}>
            {renderSettingItem({
              icon: <Info size={20} color={tintColor} />,
              title: 'About This App',
              subtitle: 'Version 1.0.0',
              action: () => Alert.alert('About', 'eBay Resale Estimator\nVersion 1.0.0\n\nAn app to help you estimate resale value of items.'),
              isLast: true
            })}
          </View>
        </Animated.View>

        <Text style={[styles.footer, { color: subtleText }]}>BidPeek © 2025</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginTop: 24,
    marginBottom: 8,
    paddingLeft: 4,
  },
  settingsGroup: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  lastSettingItem: {
    borderBottomWidth: 0,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
  },
  settingSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  footer: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 24,
  },
});