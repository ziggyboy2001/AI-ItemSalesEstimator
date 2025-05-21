import React, { useState } from 'react';
import { StyleSheet, View, Text, SafeAreaView, FlatList, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Clock, ArrowRight, Trash2, ShoppingBag } from 'lucide-react-native';

import { useRecentSearches } from '@/hooks/useRecentSearches';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import EmptyState from '@/components/EmptyState';
import { useThemeColor } from '@/constants/useThemeColor';

export default function HistoryScreen() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { recentSearches, clearRecentSearches } = useRecentSearches();
  const { searchHistory, clearSearchHistory, removeFromHistory, refreshFromSupabase } = useSearchHistory();

  // THEME COLORS
  const backgroundColor = useThemeColor('background');
  const cardColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const subtleText = useThemeColor('tabIconDefault');
  const borderColor = useThemeColor('tabIconDefault');
  const tintColor = useThemeColor('tint');
  const errorColor = useThemeColor('error');

  const handleSearchPress = (query: string) => {
    router.push({
      pathname: '/',
      params: { q: query }
    });
  };

  const handleViewItem = (item: any) => {
    const itemId = item.itemId || item.id;
    router.push({
      pathname: `/item/${itemId}`,
      params: { data: JSON.stringify(item) }
    });
  };

  const handleClearAll = () => {
    clearSearchHistory();
    clearRecentSearches();
  };

  const toggleDeleteMode = () => {
    setIsDeleting(!isDeleting);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshFromSupabase();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor }]}> 
      <Animated.View 
        style={styles.header}
        entering={FadeInDown.delay(100).duration(400)}
      >
        <Text style={[styles.title, { color: textColor }]}>Search History</Text>
        <View style={styles.headerActions}>
          {searchHistory.length > 0 && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={toggleDeleteMode}
              >
                <Text style={[styles.actionButtonText, { color: tintColor }]}>
                  {isDeleting ? 'Done' : 'Edit'}
                </Text>
              </TouchableOpacity>
              {isDeleting && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.clearButton]}
                  onPress={handleClearAll}
                >
                  <Text style={[styles.actionButtonText, styles.clearButtonText, { color: errorColor }]}>Clear All</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </Animated.View>

      <Animated.View 
        style={styles.content}
        entering={FadeInDown.delay(200).duration(400)}
      >
        {searchHistory.length > 0 ? (
          <FlatList
            data={searchHistory}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item, index }) => (
              <Animated.View
                entering={FadeInDown.delay(150 + index * 50).duration(400)}
                layout={Layout.springify()}
              >
                <TouchableOpacity
                  style={[styles.historyItem, { backgroundColor: cardColor, shadowColor: borderColor }]}
                  onPress={() => handleViewItem(item)}
                >
                  <View style={styles.historyItemContent}>
                    <View style={styles.historyImageContainer}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={styles.historyImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.noImageContainer}>
                          <ShoppingBag size={20} color={subtleText} />
                        </View>
                      )}
                    </View>
                    <View style={styles.historyItemText}>
                      <Text style={[styles.historyItemQuery, { color: textColor }]}>{item.query}</Text>
                      <Text style={[styles.historyItemTitle, { color: subtleText }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={[styles.historyItemTime, { color: subtleText }]}>
                        {new Date(item.timestamp).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  {isDeleting ? (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => removeFromHistory(item.id)}
                    >
                      <Trash2 size={20} color={errorColor} />
                    </TouchableOpacity>
                  ) : (
                    <ArrowRight size={16} color={subtleText} />
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        ) : (
          <EmptyState
            title="No Search History"
            description="Your recent searches and viewed items will appear here"
            icon="Clock"
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
  },
  headerActions: {
    flexDirection: 'row',
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  actionButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  clearButton: {
    marginLeft: 8,
  },
  clearButtonText: {},
  content: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  historyItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyImageContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f7f7f7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  historyImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f7f7f7',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
    borderRadius: 8,
  },
  historyItemText: {
    flex: 1,
  },
  historyItemQuery: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  historyItemTitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginBottom: 4,
  },
  historyItemTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
  },
});