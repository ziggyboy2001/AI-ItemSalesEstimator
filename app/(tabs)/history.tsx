import { useState } from 'react';
import { StyleSheet, View, Text, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Clock, ArrowRight, Trash2 } from 'lucide-react-native';

import { useRecentSearches } from '@/hooks/useRecentSearches';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import EmptyState from '@/components/EmptyState';
import Colors from '@/constants/Colors';

export default function HistoryScreen() {
  const [isDeleting, setIsDeleting] = useState(false);
  
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { recentSearches, clearRecentSearches } = useRecentSearches();
  const { searchHistory, clearSearchHistory, removeFromHistory } = useSearchHistory();

  const handleSearchPress = (query) => {
    router.push({
      pathname: '/',
      params: { q: query }
    });
  };

  const handleViewItem = (itemId, itemData) => {
    router.push({
      pathname: `/item/${itemId}`,
      params: { data: JSON.stringify(itemData) }
    });
  };

  const handleClearAll = () => {
    clearSearchHistory();
    clearRecentSearches();
  };

  const toggleDeleteMode = () => {
    setIsDeleting(!isDeleting);
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <Animated.View 
        style={styles.header}
        entering={FadeInDown.delay(100).duration(400)}
      >
        <Text style={styles.title}>Search History</Text>
        <View style={styles.headerActions}>
          {searchHistory.length > 0 && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={toggleDeleteMode}
              >
                <Text style={styles.actionButtonText}>
                  {isDeleting ? 'Done' : 'Edit'}
                </Text>
              </TouchableOpacity>
              
              {isDeleting && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.clearButton]}
                  onPress={handleClearAll}
                >
                  <Text style={[styles.actionButtonText, styles.clearButtonText]}>
                    Clear All
                  </Text>
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
                  style={styles.historyItem}
                  onPress={() => handleViewItem(item.itemId, item)}
                >
                  <View style={styles.historyItemContent}>
                    <View style={styles.historyIconContainer}>
                      <Clock size={18} color="#777" />
                    </View>
                    <View style={styles.historyItemText}>
                      <Text style={styles.historyItemQuery}>{item.query}</Text>
                      <Text style={styles.historyItemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.historyItemTime}>
                        {new Date(item.timestamp).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  
                  {isDeleting ? (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => removeFromHistory(item.id)}
                    >
                      <Trash2 size={20} color="#ff3b30" />
                    </TouchableOpacity>
                  ) : (
                    <ArrowRight size={16} color="#bbb" />
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}
            contentContainerStyle={styles.listContent}
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
    backgroundColor: '#f8f9fa',
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
    color: '#111',
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
    color: Colors.light.tint,
  },
  clearButton: {
    marginLeft: 8,
  },
  clearButtonText: {
    color: '#ff3b30',
  },
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
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
  historyIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyItemText: {
    flex: 1,
  },
  historyItemQuery: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  historyItemTitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  historyItemTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    padding: 8,
  },
});