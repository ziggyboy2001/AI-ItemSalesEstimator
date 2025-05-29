import React from 'react';
import { useState, useCallback } from 'react';
import { StyleSheet, View, Text, SafeAreaView, TextInput, FlatList, ActivityIndicator, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Modal, Button, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshControl } from 'react-native-gesture-handler';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Search as SearchIcon, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { differenceInDays } from 'date-fns';

import { inferEbayRequestFields } from '@/utils/gptEbayRequestInference';
import { fetchEbayCompletedItems } from '@/services/ebayCompletedApi';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import EmptyState from '@/components/EmptyState';
import ItemCard from '@/components/ItemCard';
import SearchStatsCard from '@/components/SearchStatsCard';
import { SearchResultSkeleton, StatsCardSkeleton, SkeletonList } from '@/components/SkeletonLoader';
import { calculateSearchStats } from '@/utils/calculateStats';
import { useThemeColor } from '@/constants/useThemeColor';
import { identifyItemFromImage } from '@/utils/openaiVision';
import { useSearchHistory } from '@/hooks/useSearchHistory';

interface SearchResult {
  itemId: string;
  title: string;
  price: number | string;
  image?: string;
  condition?: string;
  timestamp: string;
  query: string;
  url?: string;
  shipping?: number | string;
  buyingFormat?: string;
  [key: string]: any;
}

function calculateStatsAndFlags(items: import('@/services/ebayCompletedApi').EbayCompletedItem[]): { stats: any, itemFlags: { isOutlier: string | null, isMostRecent: boolean }[] } {
  if (!items || items.length === 0) return {
    stats: null,
    itemFlags: [],
  };

  // Extract sale prices and dates
  const prices: number[] = items.map((item: import('@/services/ebayCompletedApi').EbayCompletedItem) => item.sale_price);
  const dates: Date[] = items.map((item: import('@/services/ebayCompletedApi').EbayCompletedItem) => new Date(item.date_sold));
  const min_price = Math.min(...prices);
  const max_price = Math.max(...prices);
  const average_price = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
  const stddev = Math.sqrt(prices.reduce((a: number, b: number) => a + Math.pow(b - average_price, 2), 0) / prices.length);

  // Outlier logic: 1 stddev from mean
  const outlierFlags: (string | null)[] = prices.map((price: number) => {
    if (price >= average_price + stddev) return 'high';
    if (price <= average_price - stddev) return 'low';
    return null;
  });

  // Most recent sale
  let mostRecentIdx = 0;
  let mostRecentDate = dates[0];
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] > mostRecentDate) {
      mostRecentDate = dates[i];
      mostRecentIdx = i;
    }
  }

  // Resaleability score: based on number of comps and price stability
  let resaleability_score = Math.round(
    Math.min(99, Math.max(1, (items.length * 2) + (50 - Math.min(50, stddev))))
  );

  // Match quality: based on number of comps and price range
  let match_quality = Math.round(
    Math.min(100, Math.max(10, (items.length * 2) + (100 - (max_price - min_price))))
  );

  // Most recent sale info
  const most_recent_sale = {
    price: items[mostRecentIdx].sale_price,
    date: items[mostRecentIdx].date_sold,
  };

  // Market activity (simple string)
  let market_activity = '';
  if (items.length > 50) market_activity = 'High';
  else if (items.length > 10) market_activity = 'Medium';
  else if (items.length > 0) market_activity = 'Low';

  return {
    stats: {
      average_price,
      min_price,
      max_price,
      results: items.length,
      most_recent_sale,
      resaleability_score,
      match_quality,
      market_activity,
    },
    itemFlags: items.map((item: import('@/services/ebayCompletedApi').EbayCompletedItem, idx: number) => ({
      isOutlier: outlierFlags[idx],
      isMostRecent: idx === mostRecentIdx,
    })),
  };
}

// Add mapping function
function mapEbayItemToSearchResult(item: import('@/services/ebayCompletedApi').EbayCompletedItem, query: string): SearchResult {
  return {
    itemId: item.item_id,
    title: item.title,
    price: item.sale_price,
    image: item.image_url,
    condition: item.condition,
    timestamp: item.date_sold,
    query,
    url: item.link,
    shipping: item.shipping_price,
    buyingFormat: item.buying_format,
    // ...add any other fields as needed
  };
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
  const [stats, setStats] = useState<any>(null);
  const [itemFlags, setItemFlags] = useState<any[]>([]);
  const [purchasePrice, setPurchasePrice] = useState<string>('');

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addRecentSearch, recentSearches } = useRecentSearches();
  const { addToHistory } = useSearchHistory();

  // THEME COLORS
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const subtleText = useThemeColor('tabIconDefault');
  const borderColor = useThemeColor('tabIconDefault');
  const tintColor = useThemeColor('tint');
  const errorColor = useThemeColor('error');
  const cardColor = useThemeColor('background');

  const handleSearch = useCallback(async (query = searchQuery) => {
    if (!query.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const ebayRequest = await inferEbayRequestFields(query);
      const data = await fetchEbayCompletedItems(ebayRequest);
      const items = (data.items || []);
      const mappedResults = items.map(item => mapEbayItemToSearchResult(item, query));
      const { stats: newStats, itemFlags: newItemFlags } = calculateStatsAndFlags(items);
      setStats(newStats);
      setItemFlags(newItemFlags);
      setResults(mappedResults);
      addRecentSearch(query);
      // Save to search history
      if (mappedResults.length > 0) {
        // Use the first result as representative of the search
        const firstResult = mappedResults[0];
        const historyData = {
          query,
          title: firstResult.title || query,
          itemId: firstResult.itemId,
          image: firstResult.image,
          link: firstResult.url,
          price: newStats?.average_price || firstResult.price,
        };
        
        await addToHistory(historyData);
      } else {
        // Still save the search even if no results
        const historyData = { 
          query,
          title: query 
        };
        await addToHistory(historyData);
      }
    } catch (err) {
      setError('Failed to fetch results. Please try again.');
      console.error('Search error:', err);
      // Save failed search attempt too
      const historyData = { 
        query,
        title: query 
      };
      await addToHistory(historyData);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, addRecentSearch, addToHistory]);

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

  const handleAiConfirm = async () => {
    setSearchQuery(aiDescription);
    setAiModalVisible(false);
    await handleSearch(aiDescription);
  };

  // Add debug log for results before render
  // console.log('Results state before render:', results);

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <Animated.View 
          style={styles.header}
          entering={FadeInDown.delay(100).duration(400)}
        >
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            <View>
              <Text style={[styles.title, { color: textColor }]}>BidPeek</Text>
              <Text style={[styles.subtitle, { color: subtleText }]}>Find the true resale value of any item</Text>
            </View>
            <View>
              <Image source={require('../../assets/images/iconVector.png')} style={{width: 28, height: 28}} />
            </View>
          </View>
        </Animated.View>

        <Animated.View 
          style={styles.searchContainer}
          entering={FadeInDown.delay(200).duration(400)}
          layout={Layout.springify()}
        >
          <View style={[styles.searchInputContainer, { backgroundColor: cardColor, borderColor: borderColor, shadowColor: borderColor } ] }>
            <SearchIcon size={20} color={subtleText} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: textColor }]}
              placeholder="Search for an item (e.g., iPhone X)"
              placeholderTextColor={subtleText}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => handleSearch()}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
                <X size={18} color={subtleText} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.searchButton, { backgroundColor: backgroundColor, borderColor: tintColor, borderWidth: 1, shadowColor: tintColor }]}
            onPress={() => handleSearch()}
            disabled={!searchQuery.trim()}
          >
            <Text style={[styles.searchButtonText, { color: tintColor }]}>Search</Text>
          </TouchableOpacity>
        </Animated.View>

        {!isLoading && !results.length && !error && (
          <View style={styles.recentSearchesContainer}>
            <Text style={[styles.recentSearchesTitle, { color: textColor }]}>Recent Searches</Text>
            {recentSearches.length > 0 ? (
              <FlatList
                data={recentSearches}
                keyExtractor={(item, index) => `${item}-${index}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[styles.recentSearchItem, { backgroundColor: cardColor, borderColor: borderColor }]}
                    onPress={() => handleRecentSearchPress(item)}
                  >
                    <Text style={[styles.recentSearchText, { color: subtleText }]}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <Text style={[styles.noRecentSearches, { color: subtleText }]}>Your recent searches will appear here</Text>
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
          <View style={{ flex: 1, paddingTop: 20 }}>
            {/* Stats Card Skeleton */}
            <StatsCardSkeleton />
            {/* Search Results Skeletons */}
            <SkeletonList count={6} ItemSkeleton={SearchResultSkeleton} />
          </View>
        ) : results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={(item, index) => `${item?.itemId || 'item'}-${index}`}
            ListHeaderComponent={() => (
              <>
                {stats && (
                  <>
                    <SearchStatsCard 
                      stats={stats} 
                      purchasePrice={parseFloat(purchasePrice) || undefined} 
                      searchTitle={searchQuery} 
                    />
                  </>
                )}
              </>
            )}
            renderItem={({ item, index }) => {
              // console.log('Rendering card:', item.title, item.itemId);
              return (
                <Animated.View
                  entering={FadeInDown.delay(150 + index * 50).duration(400)}
                  layout={Layout.springify()}
                >
                  <ItemCard
                    item={{
                      title: item.title,
                      sale_price: typeof item.price === 'number' ? item.price : Number(item.price),
                      image_url: item.image,
                      condition: item.condition,
                      date_sold: item.timestamp,
                      buying_format: item.buyingFormat,
                      shipping_price: item.shipping,
                      link: item.url,
                    }}
                    onPress={() => handleItemPress(item)}
                    isOutlier={itemFlags[index]?.isOutlier}
                    isMostRecent={itemFlags[index]?.isMostRecent}
                    purchasePrice={parseFloat(purchasePrice) || undefined}
                  />
                </Animated.View>
              );
            }}
            contentContainerStyle={styles.resultsContainer}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={tintColor}
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
          style={[styles.searchButton, { marginHorizontal: 16, marginBottom: 8, backgroundColor: tintColor, shadowColor: tintColor }]}
          onPress={handleIdentifyItem}
        >
          <Text style={styles.searchButtonText}>Identify an item with AI</Text>
        </TouchableOpacity>

        <Modal
          visible={aiModalVisible || aiLoading}
          animationType="slide"
          transparent={true}
          onRequestClose={() => { if (!aiLoading) setAiModalVisible(false); }}
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <View style={{ backgroundColor: cardColor, borderRadius: 12, padding: 24, width: '85%', alignItems: 'center' }}>
              {aiLoading ? (
                <>
                  <ActivityIndicator size="large" color={tintColor} />
                  <Text style={{ fontSize: 16, marginTop: 16, color: subtleText }}>Identifying item...</Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: textColor }}>AI Description</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: borderColor, borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 16, width: '100%', color: textColor }}
                    value={aiDescription}
                    onChangeText={setAiDescription}
                    multiline
                    placeholderTextColor={subtleText}
                  />
                  {aiError ? <Text style={{ color: errorColor, marginBottom: 8 }}>{aiError}</Text> : null}
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', width: '100%' }}>
                    <Button title="Cancel" onPress={() => setAiModalVisible(false)} color={subtleText} />
                    <View style={{ width: 12 }} />
                    <Button title="Search" onPress={handleAiConfirm} disabled={!aiDescription.trim()} color={tintColor} />
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
    paddingHorizontal: 16,
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
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  searchButtonText: {
    color: '#000000',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  recentSearchesContainer: {
    paddingHorizontal: 16,
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
  },
  resultsContainer: {
    padding: 16,
    paddingTop: 8,
  },
});