import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronRight, Info, Moon, User, Trash2, Key, MoonStar, Bell } from 'lucide-react-native';
import { useState } from 'react';

import { useSavedItems } from '@/hooks/useSavedItems';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import Colors from '@/constants/Colors';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  
  const { clearSavedItems } = useSavedItems();
  const { clearSearchHistory } = useSearchHistory();
  const { clearRecentSearches } = useRecentSearches();

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

  const renderSectionHeader = (title) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  const renderSettingItem = ({ icon, title, subtitle, action, isLast = false }) => (
    <TouchableOpacity
      style={[styles.settingItem, isLast && styles.lastSettingItem]}
      onPress={action}
    >
      <View style={styles.settingIcon}>{icon}</View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <ChevronRight size={20} color="#ccc" />
    </TouchableOpacity>
  );

  const renderToggleItem = ({ icon, title, subtitle, value, onValueChange, isLast = false }) => (
    <View style={[styles.settingItem, isLast && styles.lastSettingItem]}>
      <View style={styles.settingIcon}>{icon}</View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#d9d9d9', true: '#34c759' }}
        thumbColor="#ffffff"
        ios_backgroundColor="#d9d9d9"
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <Animated.View 
        style={styles.header}
        entering={FadeInDown.delay(100).duration(400)}
      >
        <Text style={styles.title}>Settings</Text>
      </Animated.View>

      <ScrollView style={styles.scrollView}>
        <Animated.View 
          style={styles.content}
          entering={FadeInDown.delay(200).duration(400)}
        >
          {renderSectionHeader('Appearance')}
          <View style={styles.settingsGroup}>
            {renderToggleItem({
              icon: <Moon size={20} color={Colors.light.tint} />,
              title: 'Dark Mode',
              subtitle: 'Switch between light and dark theme',
              value: darkMode,
              onValueChange: setDarkMode
            })}
            {renderToggleItem({
              icon: <Bell size={20} color={Colors.light.tint} />,
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
              icon: <User size={20} color={Colors.light.tint} />,
              title: 'Account Settings',
              subtitle: 'Manage your profile and preferences',
              action: () => Alert.alert('Account Settings', 'This feature is coming soon.')
            })}
            {renderSettingItem({
              icon: <Key size={20} color={Colors.light.tint} />,
              title: 'API Key',
              subtitle: 'Manage your eBay API credentials',
              action: () => Alert.alert('API Settings', 'This feature is coming soon.'),
              isLast: true
            })}
          </View>

          {renderSectionHeader('Data')}
          <View style={styles.settingsGroup}>
            {renderSettingItem({
              icon: <Trash2 size={20} color="#ff3b30" />,
              title: 'Clear All Data',
              subtitle: 'Erase all saved items and search history',
              action: handleClearAllData,
              isLast: true
            })}
          </View>

          {renderSectionHeader('About')}
          <View style={styles.settingsGroup}>
            {renderSettingItem({
              icon: <Info size={20} color={Colors.light.tint} />,
              title: 'About This App',
              subtitle: 'Version 1.0.0',
              action: () => Alert.alert('About', 'eBay Resale Estimator\nVersion 1.0.0\n\nAn app to help you estimate resale value of items on eBay.'),
              isLast: true
            })}
          </View>
        </Animated.View>

        <Text style={styles.footer}>
          eBay Resale Estimator © 2025
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    color: '#111',
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
    color: '#777',
    marginTop: 24,
    marginBottom: 8,
    paddingLeft: 4,
  },
  settingsGroup: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lastSettingItem: {
    borderBottomWidth: 0,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
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
    color: '#333',
  },
  settingSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  footer: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginVertical: 24,
  },
});