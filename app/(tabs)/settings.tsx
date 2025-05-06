import React, { useState } from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronRight, Info, Moon, User, Trash2, Key, MoonStar, Bell } from 'lucide-react-native';

import { useSavedItems } from '@/hooks/useSavedItems';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { useThemeColor } from '@/constants/useThemeColor';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  
  const { clearSavedItems } = useSavedItems();
  const { clearSearchHistory } = useSearchHistory();
  const { clearRecentSearches } = useRecentSearches();

  // THEME COLORS
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const subtleText = useThemeColor('tabIconDefault');
  const borderColor = useThemeColor('tabIconDefault');
  const tintColor = useThemeColor('tint');
  const errorColor = useThemeColor('error');
  const cardColor = useThemeColor('background');

  const handleClearAllData = () => {
    Alert.alert(
      "Clear All App Data",
      "This will erase all your saved items, search history, and preferences. This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Clear All Data",
          style: "destructive",
          onPress: () => {
            clearSavedItems();
            clearSearchHistory();
            clearRecentSearches();
            Alert.alert("Success", "All app data has been cleared");
          }
        }
      ]
    );
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
        <Text style={[styles.title, { color: textColor }]}>Settings</Text>
      </Animated.View>

      <ScrollView style={styles.scrollView}>
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
              value: darkMode,
              onValueChange: setDarkMode
            })}
            {renderToggleItem({
              icon: <Bell size={20} color={tintColor} />,
              title: 'Notifications',
              subtitle: 'Get alerts for price drops on saved items',
              value: notifications,
              onValueChange: setNotifications,
              isLast: true
            })}
          </View>

          {renderSectionHeader('Account')}
          <View style={styles.settingsGroup}>
            {renderSettingItem({
              icon: <User size={20} color={tintColor} />,
              title: 'Account Settings',
              subtitle: 'Manage your profile and preferences',
              action: () => Alert.alert('Account Settings', 'This feature is coming soon.')
            })}
            {renderSettingItem({
              icon: <Key size={20} color={tintColor} />,
              title: 'API Key',
              subtitle: 'Manage your eBay API credentials',
              action: () => Alert.alert('API Settings', 'This feature is coming soon.'),
              isLast: true
            })}
          </View>

          {renderSectionHeader('Data')}
          <View style={styles.settingsGroup}>
            {renderSettingItem({
              icon: <Trash2 size={20} color={errorColor} />,
              title: 'Clear All Data',
              subtitle: 'Erase all saved items and search history',
              action: handleClearAllData,
              isLast: true
            })}
          </View>

          {renderSectionHeader('About')}
          <View style={styles.settingsGroup}>
            {renderSettingItem({
              icon: <Info size={20} color={tintColor} />,
              title: 'About This App',
              subtitle: 'Version 1.0.0',
              action: () => Alert.alert('About', 'eBay Resale Estimator\nVersion 1.0.0\n\nAn app to help you estimate resale value of items on eBay.'),
              isLast: true
            })}
          </View>
        </Animated.View>

        <Text style={[styles.footer, { color: subtleText }]}>eBay Resale Estimator © 2025</Text>
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