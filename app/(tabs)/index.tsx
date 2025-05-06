import React from 'react';
import { useState, useCallback } from 'react';
import { StyleSheet, View, Text, SafeAreaView, TextInput, FlatList, ActivityIndicator, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Modal, Button, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshControl } from 'react-native-gesture-handler';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Search as SearchIcon, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { searchEbayItems } from '@/services/ebayApi';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import EmptyState from '@/components/EmptyState';
import ItemCard from '@/components/ItemCard';
import SearchStatsCard from '@/components/SearchStatsCard';
import { calculateSearchStats } from '@/utils/calculateStats';
import Colors from '@/constants/Colors';
import { identifyItemFromImage } from '@/utils/openaiVision';

interface SearchResult {
  itemId: string;
  title: string;
  price: number | string;
  image?: string;
  condition?: string;
  timestamp: string;
  query: string;
  [key: string]: any;
}

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addRecentSearch, recentSearches } = useRecentSearches();

  const handleSearch = useCallback(async (query = searchQuery) => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const data = await searchEbayItems(query);
      setResults(data);
      addRecentSearch(query);
    } catch (err) {
      setError('Failed to fetch results. Please try again.');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, addRecentSearch]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    handleSearch();
  }, [handleSearch]);

  const handleClearSearch = () => {
    setSearchQuery('');
    setResults([]);
  };

  const handleItemPress = (item: SearchResult) => {
    router.push({
      pathname: '/item/[id]',
      params: { id: item.itemId, data: JSON.stringify(item) }
    });
  };

  const handleRecentSearchPress = (query: string) => {
    setSearchQuery(query);
    handleSearch(query);
  };

  const handleIdentifyItem = async () => {
    try {
      Alert.alert(
        'Identify Item',
        'Take a photo or choose from gallery?',
        [
          { text: 'Camera', onPress: () => pickImage('camera') },
          { text: 'Gallery', onPress: () => pickImage('gallery') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } catch (err) {
      setAiError('Failed to start image picker');
    }
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    try {
      let permissionResult;
      if (source === 'camera') {
        permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        console.log('Camera permission:', permissionResult);
        if (!permissionResult.granted) {
          Alert.alert('Permission required', 'Camera permission is required to take a photo.');
          return;
        }
      } else {
        permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log('Media library permission:', permissionResult);
        if (!permissionResult.granted) {
          Alert.alert('Permission required', 'Media library permission is required to select a photo.');
          return;
        }
      }

      let result;
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: 'images',
          base64: true,
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          base64: true,
          quality: 0.8,
        });
      }
      console.log('ImagePicker result:', result);

      if (result.canceled) {
        Alert.alert('Cancelled', 'No image was selected.');
        return;
      }

      if (!result.assets || !result.assets[0] || !result.assets[0].base64) {
        Alert.alert('Error', 'No image data found.');
        return;
      }

      setAiLoading(true);
      setAiModalVisible(true);
      setAiError('');
      setAiDescription('');
      try {
        const description = await identifyItemFromImage(result.assets[0].base64);
        console.log('AI description:', description);
        if (!description) {
          setAiError('AI did not return a description.');
        }
        setAiDescription(description || '');
      } catch (err) {
        console.error('AI error:', err);
        setAiError('Failed to identify item.');
      } finally {
        setAiLoading(false);
      }
    } catch (err) {
      console.error('pickImage error:', err);
      Alert.alert('Error', 'Something went wrong while picking the image.');
    }
  };

  const handleAiConfirm = () => {
    setSearchQuery(aiDescription);
    setAiModalVisible(false);
    handleSearch(aiDescription);
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <Animated.View 
          style={styles.header}
          entering={FadeInDown.delay(100).duration(400)}
        >
          <Text style={styles.title}>eBay Resale Estimator</Text>
          <Text style={styles.subtitle}>Find the true value of any item</Text>
        </Animated.View>

        <Animated.View 
          style={styles.searchContainer}
          entering={FadeInDown.delay(200).duration(400)}
          layout={Layout.springify()}
        >
          <View style={styles.searchInputContainer}>
            <SearchIcon size={20} color="#777" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for an item (e.g., iPhone X)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => handleSearch()}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
                <X size={18} color="#888" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={styles.searchButton}
            onPress={() => handleSearch()}
            disabled={!searchQuery.trim()}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </Animated.View>

        {!isLoading && !results.length && !error && (
          <View style={styles.recentSearchesContainer}>
            <Text style={styles.recentSearchesTitle}>Recent Searches</Text>
            {recentSearches.length > 0 ? (
              <FlatList
                data={recentSearches}
                keyExtractor={(item, index) => `${item}-${index}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.recentSearchItem}
                    onPress={() => handleRecentSearchPress(item)}
                  >
                    <Text style={styles.recentSearchText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <Text style={styles.noRecentSearches}>
                Your recent searches will appear here
              </Text>
            )}
          </View>
        )}

        {error ? (
          <EmptyState
            title="Something went wrong"
            description={error}
            icon="AlertCircle"
            action={{ label: 'Try Again', onPress: () => handleSearch() }}
          />
        ) : isLoading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.tint} />
            <Text style={styles.loadingText}>Searching eBay...</Text>
          </View>
        ) : results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={(item, index) => `${item?.itemId || 'item'}-${index}`}
            ListHeaderComponent={() => (
              <SearchStatsCard stats={calculateSearchStats(results)} />
            )}
            renderItem={({ item, index }) => (
              <Animated.View
                entering={FadeInDown.delay(150 + index * 50).duration(400)}
                layout={Layout.springify()}
              >
                <ItemCard item={item} onPress={() => handleItemPress(item)} />
              </Animated.View>
            )}
            contentContainerStyle={styles.resultsContainer}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.light.tint}
              />
            }
          />
        ) : searchQuery.trim() && !isLoading ? (
          <EmptyState
            title="No Results Found"
            description="Try using different keywords or check your spelling"
            icon="Search"
          />
        ) : null}

        <TouchableOpacity 
          style={[styles.searchButton, { marginHorizontal: 16, marginBottom: 8 }]}
          onPress={handleIdentifyItem}
        >
          <Text style={styles.searchButtonText}>Identify Item (AI)</Text>
        </TouchableOpacity>

        <Modal
          visible={aiModalVisible || aiLoading}
          animationType="slide"
          transparent={true}
          onRequestClose={() => { if (!aiLoading) setAiModalVisible(false); }}
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, width: '85%', alignItems: 'center' }}>
              {aiLoading ? (
                <>
                  <ActivityIndicator size="large" color={Colors.light.tint} />
                  <Text style={{ fontSize: 16, marginTop: 16 }}>Identifying item...</Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>AI Description</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 16, width: '100%' }}
                    value={aiDescription}
                    onChangeText={setAiDescription}
                    multiline
                  />
                  {aiError ? <Text style={{ color: 'red', marginBottom: 8 }}>{aiError}</Text> : null}
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', width: '100%' }}>
                    <Button title="Cancel" onPress={() => setAiModalVisible(false)} />
                    <View style={{ width: 12 }} />
                    <Button title="Search eBay" onPress={handleAiConfirm} disabled={!aiDescription.trim()} />
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardAvoid: {
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
    color: '#111',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#777',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 8,
    marginBottom: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginRight: 10,
    height: 48,
    borderWidth: 1,
    borderColor: '#eaeaea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  clearButton: {
    padding: 6,
  },
  searchButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  searchButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  recentSearchesContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  recentSearchesTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  recentSearchItem: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  recentSearchText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#666',
  },
  noRecentSearches: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'Inter_400Regular',
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  resultsContainer: {
    padding: 16,
    paddingTop: 8,
  },
});