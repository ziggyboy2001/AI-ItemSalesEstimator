import { useState } from 'react';
import { StyleSheet, View, Text, SafeAreaView, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, Layout, FadeOut } from 'react-native-reanimated';
import { Bookmark, Trash2 } from 'lucide-react-native';

import { useSavedItems } from '@/hooks/useSavedItems';
import EmptyState from '@/components/EmptyState';
import ItemCard from '@/components/ItemCard';
import Colors from '@/constants/Colors';

export default function SavedScreen() {
  const [isDeleting, setIsDeleting] = useState(false);
  
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { savedItems, removeFromSaved, clearSavedItems } = useSavedItems();

  const handleItemPress = (item) => {
    router.push({
      pathname: `/item/${item.itemId}`,
      params: { data: JSON.stringify(item) }
    });
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear All Saved Items",
      "Are you sure you want to remove all saved items? This cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Clear All",
          style: "destructive",
          onPress: clearSavedItems
        }
      ]
    );
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
        <Text style={styles.title}>Saved Items</Text>
        <View style={styles.headerActions}>
          {savedItems.length > 0 && (
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
        {savedItems.length > 0 ? (
          <FlatList
            data={savedItems}
            keyExtractor={(item) => item.itemId.toString()}
            renderItem={({ item, index }) => (
              <Animated.View
                entering={FadeInDown.delay(150 + index * 50).duration(400)}
                exiting={FadeOut.duration(300)}
                layout={Layout.springify()}
              >
                <ItemCard 
                  item={item} 
                  onPress={() => handleItemPress(item)}
                  isDeleting={isDeleting}
                  onDelete={() => removeFromSaved(item.itemId)}
                />
              </Animated.View>
            )}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <EmptyState
            title="No Saved Items"
            description="Items you save will appear here for easy access"
            icon="Bookmark"
            action={{ 
              label: 'Start Searching', 
              onPress: () => router.push('/') 
            }}
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
});