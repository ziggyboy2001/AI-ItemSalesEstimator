import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, SafeAreaView, TextInput, FlatList, ActivityIndicator, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Modal, Button, Alert, Linking, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshControl } from 'react-native-gesture-handler';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Search as SearchIcon, X, Camera, ImageIcon, RefreshCw, TrendingUp, AlertCircle, Zap, Sparkles, User, ChevronRight, ExternalLink } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { differenceInDays } from 'date-fns';
import Markdown from 'react-native-markdown-display';

import { inferEbayRequestFields } from '@/utils/gptEbayRequestInference';
import { fetchEbayCompletedItems } from '@/services/ebayCompletedApi';
import { progressiveSearch } from '@/utils/searchStrategies';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import EmptyState from '@/components/EmptyState';
import ItemCard from '@/components/ItemCard';
import SearchStatsCard from '@/components/SearchStatsCard';
import { SearchResultSkeleton, StatsCardSkeleton, SkeletonList } from '@/components/SkeletonLoader';
import { calculateSearchStats } from '@/utils/calculateStats';
import { useThemeColor } from '@/constants/useThemeColor';
import { identifyItemFromImage } from '@/utils/openaiVision';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { searchWebWithOpenAI, searchWebWithChatGPT, simpleAIWebSearch, searchByImage } from '@/services/aiWebSearch';
import { generateGoogleShoppingSearchURL, generateGoogleLensURL } from '@/services/googleImageSearch';
import { searchByImage as ebaySearchByImage, EbayError, EbayErrorType, calculateEbayImageSearchStats, simplifyItemTitle } from '@/services/ebayApi';
import { searchEbayListings, calculateEbayBrowseStats, EbayBrowseError, EbayBrowseErrorType } from '@/services/ebayBrowseApi';
import { SubscriptionService } from '@/services/subscriptionService';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useSubscription } from '@/contexts/SubscriptionContext';

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
  source: string;
  sourceWebsite?: string;
  stats?: any;
  items?: import('@/services/ebayCompletedApi').EbayCompletedItem[];
  // Current listings specific data
  seller?: {
    username: string;
    feedbackPercentage: string;
    feedbackScore: number;
  };
  additionalImages?: Array<{ imageUrl: string }>;
  topRatedBuyingExperience?: boolean;
  buyingOptions?: string[];
  itemOriginDate?: string;
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
function mapEbayItemToSearchResult(item: any, query: string): SearchResult {
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
    source: item.source_website || 'ebay',
    sourceWebsite: item.source_website,
    items: [item],
    // Include current listing specific data at the top level
    seller: item.seller,
    additionalImages: item.additionalImages,
    topRatedBuyingExperience: item.topRatedBuyingExperience,
    buyingOptions: item.buyingOptions,
    itemOriginDate: item.itemOriginDate,
    itemLocation: item.itemLocation,
    shippingOptions: item.shippingOptions,
    availableCoupons: item.availableCoupons,
  };
}

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // Base64 image data
  const [isImageSearch, setIsImageSearch] = useState(false);
  
  // Separate state for each tab
  const [soldResults, setSoldResults] = useState<SearchResult[]>([]);
  const [soldStats, setSoldStats] = useState<any>(null);
  const [soldItemFlags, setSoldItemFlags] = useState<any[]>([]);
  const [soldError, setSoldError] = useState('');
  
  const [listingsResults, setListingsResults] = useState<SearchResult[]>([]);
  const [listingsStats, setListingsStats] = useState<any>(null);
  const [listingsItemFlags, setListingsItemFlags] = useState<any[]>([]);
  const [listingsError, setListingsError] = useState('');
  
  // Shared state
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'sold' | 'listings'>('sold');
  const [marketAnalysisModalVisible, setMarketAnalysisModalVisible] = useState(false);

  // Computed values based on active tab
  const results = activeTab === 'sold' ? soldResults : listingsResults;
  const stats = activeTab === 'sold' ? soldStats : listingsStats;
  const itemFlags = activeTab === 'sold' ? soldItemFlags : listingsItemFlags;
  const error = activeTab === 'sold' ? soldError : listingsError;

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addRecentSearch, recentSearches } = useRecentSearches();
  const { addToHistory } = useSearchHistory();
  const { deviceId } = useDeviceId();
  const { refreshUsage } = useSubscription();

  // THEME COLORS
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const subtleText = useThemeColor('tabIconDefault');
  const borderColor = useThemeColor('tabIconDefault');
  const tintColor = useThemeColor('tint');
  const errorColor = useThemeColor('error');
  const cardColor = useThemeColor('background');

  const handleEbayBrowseSearch = useCallback(async (query = searchQuery) => {
    if (!query.trim()) return;
    
    // Check scan limits before processing
    if (deviceId) {
      try {
        const { canScan, reason, usageInfo } = await SubscriptionService.canUserScan(null, deviceId, 'current_text');
        
        if (!canScan) {
          setListingsError(reason || 'Scan limit exceeded');
          
          // Show subscription upgrade modal/alert
          Alert.alert(
            'Scan Limit Reached',
            `${reason}\n\nUsage: ${usageInfo.used}/${usageInfo.limit === -1 ? '∞' : usageInfo.limit} scans this month`,
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Upgrade', 
                onPress: () => router.push('/subscription') 
              }
            ]
          );
          return;
        }
      } catch (error) {
        console.error('Error checking scan limits:', error);
        // Continue with search if limit check fails
      }
    }
    
    setIsLoading(true);
    setListingsError('');
    
    try {
      console.log('🔍 Using eBay Browse API for current listings search:', query);
      
      // Search eBay current listings using Browse API
      const ebayResponse = await searchEbayListings({
        q: query,
        limit: 50, // Get up to 50 results
        sort: 'newlyListed', // Show newest listings first
        fieldgroups: 'MATCHING_ITEMS', // Get full item details
      });
      
      console.log('✅ eBay Browse API response received:', {
        total: ebayResponse.total,
        returned: ebayResponse.itemSummaries?.length || 0
      });
      
      if (!ebayResponse.itemSummaries || ebayResponse.itemSummaries.length === 0) {
        setListingsError('No current listings found for this search.');
        setListingsResults([]);
        setListingsStats(null);
        setListingsItemFlags([]);
        
        // Still save to search history even if no results
        const historyData = { 
          query,
          title: query,
          searchType: 'current' as const,
        };
        await addToHistory(historyData);
        return;
      }
      
      // Convert eBay Browse API results to our expected format
      const convertedItems = ebayResponse.itemSummaries.map((item) => {
        return {
          item_id: item.itemId,
          title: item.title,
          sale_price: parseFloat(item.price.value) || 0,
          image_url: item.image?.imageUrl,
          condition: item.condition || 'Unknown',
          date_sold: item.itemCreationDate || new Date().toISOString(),
          link: item.itemWebUrl,
          buying_format: item.buyingOptions?.[0] || 'Current Listing',
          shipping_price: item.shippingOptions?.[0]?.shippingCost ? parseFloat(item.shippingOptions[0].shippingCost.value) : 0,
          source_website: 'ebay.com',
          // Current listings specific data
          seller: item.seller,
          additionalImages: item.additionalImages,
          topRatedBuyingExperience: item.topRatedBuyingExperience,
          buyingOptions: item.buyingOptions,
          itemOriginDate: item.itemOriginDate,
          itemLocation: item.itemLocation,
          shippingOptions: item.shippingOptions,
          availableCoupons: item.availableCoupons,
        };
      });
      
      const mappedResults = convertedItems.map(item => mapEbayItemToSearchResult(item, query));
      
      // Calculate stats from eBay Browse API response
      const stats = calculateEbayBrowseStats(ebayResponse, query);
      
      setListingsStats(stats);
      setListingsItemFlags(convertedItems.map(() => ({ isOutlier: null, isMostRecent: false })));
      setListingsResults(mappedResults);
      addRecentSearch(query);

      // Record successful scan after search completes
      if (deviceId && mappedResults.length > 0) {
        try {
          // Record the scan without search_id for now (we'll link it later if needed)
          
          // The search will be saved to history below, but we need to get its ID
          // For now, we'll record the scan without search_id and link it later if needed
          await SubscriptionService.recordScan(null, deviceId, 'current_text', '', {
            searchType: 'current',
            query,
            resultsFound: mappedResults.length
          });
          console.log('✅ Current listings text scan recorded successfully');
          
          // Refresh usage display
          await refreshUsage();
        } catch (error) {
          console.error('Error recording current listings scan:', error);
        }
      }

      // Save to search history for current listings - IMMEDIATE UPDATE
      if (mappedResults.length > 0) {
        const firstResult = mappedResults[0];
        
        // Save the complete SearchResult object with all current listing data
        const completeHistoryData = {
          ...firstResult, // Include ALL SearchResult data
          query,
          searchType: 'current' as const,
          // Ensure price is from stats for consistency
          price: stats?.average_price || firstResult.price,
        };
        
        await addToHistory(completeHistoryData);
        console.log('✅ Search history updated with complete current listing data');
      } else {
        const historyData = { 
          query,
          title: query,
          searchType: 'current' as const,
        };
        await addToHistory(historyData);
      }
      
      console.log('✅ eBay Browse Search Results:', {
        items: mappedResults.length,
        total_available: ebayResponse.total,
        average_price: stats.average_price,
        summary: stats.market_summary,
        stats_results_count: stats.results,
        ebay_response_items: ebayResponse.itemSummaries?.length
      });
      
    } catch (err) {
      console.error('❌ eBay Browse search error:', err);
      
      let errorMessage = 'Search failed. Please try again.';
      
      if (err instanceof EbayBrowseError) {
        switch (err.type) {
          case EbayBrowseErrorType.NO_RESULTS:
            errorMessage = 'No current listings found for this search. Try different keywords.';
            break;
          case EbayBrowseErrorType.RATE_LIMIT:
            errorMessage = 'Too many requests. Please wait a moment and try again.';
            break;
          case EbayBrowseErrorType.NETWORK_ERROR:
            errorMessage = 'Network error. Check your connection and try again.';
            break;
          case EbayBrowseErrorType.AUTH_FAILED:
            errorMessage = 'Authentication failed. Please try again later.';
            break;
          default:
            errorMessage = err.message || 'Search failed. Please try again.';
        }
      }
      
      setListingsError(errorMessage);
      setListingsResults([]);
      setListingsStats(null);
      setListingsItemFlags([]);
      
      // Save failed search to history
      const historyData = { 
        query,
        title: query,
        searchType: 'current' as const,
      };
      await addToHistory(historyData);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, addRecentSearch, addToHistory, deviceId, refreshUsage, router]);

  const handleSearch = useCallback(async (query = searchQuery) => {
    if (!query.trim() && !selectedImage) return;
    
    setIsLoading(true);
    
    // Priority logic: Image first, then text fallback for current listings
    if (selectedImage && isImageSearch) {
      console.log('🔍 Using image search (priority over text)...');
      
      // Check scan limits for image search before processing
      if (deviceId) {
        try {
          const { canScan, reason, usageInfo } = await SubscriptionService.canUserScan(null, deviceId, 'current_image');
          
          if (!canScan) {
            setListingsError(reason || 'Scan limit exceeded');
            
            // Show subscription upgrade modal/alert
            Alert.alert(
              'Scan Limit Reached',
              `${reason}\n\nUsage: ${usageInfo.used}/${usageInfo.limit === -1 ? '∞' : usageInfo.limit} scans this month`,
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Upgrade', 
                  onPress: () => router.push('/subscription') 
                }
              ]
            );
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error('Error checking image scan limits:', error);
          // Continue with search if limit check fails
        }
      }
      
      try {
        console.log('🔍 Using eBay Image Search for identification and data population...');
        const ebayResults = await ebaySearchByImage({
          image: selectedImage,
          limit: 50
        });
        
        if (ebayResults.itemSummaries && ebayResults.itemSummaries.length > 0) {
          const identifiedTitle = ebayResults.itemSummaries[0].title;
          console.log('✅ eBay identified item:', identifiedTitle);
          
          // Calculate stats from eBay response for Current Listings tab
          const stats = calculateEbayImageSearchStats(ebayResults, 'Image Search');
          
          // Convert eBay results to our expected format for Current Listings tab
          const convertedItems = ebayResults.itemSummaries.map((item) => {
            return {
              item_id: item.itemId,
              title: item.title,
              sale_price: parseFloat(item.price.value) || 0,
              image_url: item.image?.imageUrl,
              condition: item.condition || 'Unknown',
              date_sold: new Date().toISOString(),
              link: item.itemWebUrl,
              buying_format: item.buyingOptions?.[0] || 'Current Listing',
              shipping_price: item.shippingOptions?.[0]?.shippingCost ? parseFloat(item.shippingOptions[0].shippingCost.value) : 0,
              source_website: 'ebay.com',
              // Current listings specific data
              seller: item.seller,
              additionalImages: item.additionalImages,
              topRatedBuyingExperience: item.topRatedBuyingExperience,
              buyingOptions: item.buyingOptions,
              itemOriginDate: item.itemOriginDate,
            };
          });
          
          const mappedResults = convertedItems.map(item => mapEbayItemToSearchResult(item, 'Image Search'));
          
          // Populate Current Listings tab with the eBay image search results
          setListingsResults(mappedResults);
          setListingsStats(stats);
          setListingsItemFlags(convertedItems.map(() => ({ isOutlier: null, isMostRecent: false })));
          
          console.log('✅ Populated Current Listings tab with', mappedResults.length, 'items');
          
          // Set the search query (use original title for Current Listings)
          setSearchQuery(identifiedTitle);
          
          // Record successful image scan after search completes
          if (deviceId && mappedResults.length > 0) {
            try {
              await SubscriptionService.recordScan(null, deviceId, 'current_image', '', {
                searchType: 'current',
                query: 'Image Search',
                identifiedTitle,
                resultsFound: mappedResults.length
              });
              console.log('✅ Current listings image scan recorded successfully');
              
              // Refresh usage display
              await refreshUsage();
            } catch (error) {
              console.error('Error recording current listings image scan:', error);
            }
          }
          
          // Save image search to history immediately
          if (mappedResults.length > 0) {
            const firstResult = mappedResults[0];
            
            // Save the complete SearchResult object with all current listing data
            const completeHistoryData = {
              ...firstResult, // Include ALL SearchResult data
              query: identifiedTitle,
              searchType: 'current' as const,
              // Ensure price is from stats for consistency
              price: stats?.average_price || firstResult.price,
            };
            
            await addToHistory(completeHistoryData);
            console.log('✅ Image search history updated with complete current listing data');
          }
          
          setIsLoading(false);
          return; // Success - exit early
        } else {
          console.log('❌ Image search returned no results');
          // If image search fails and we have text, fallback to text search
          if (query.trim()) {
            console.log('🔄 Falling back to text search...');
            // Continue to text search below
          } else {
            if (activeTab === 'sold') {
              setSoldError('Could not identify item from image. Please try again or add a text description.');
            } else {
              setListingsError('Could not identify item from image. Please try again or add a text description.');
            }
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('❌ Image search failed:', err);
        // If image search fails and we have text, fallback to text search
        if (query.trim()) {
          console.log('🔄 Image search failed, falling back to text search...');
          // Continue to text search below
        } else {
          if (activeTab === 'sold') {
            setSoldError('Failed to identify item from image. Please try again or add a text description.');
          } else {
            setListingsError('Failed to identify item from image. Please try again or add a text description.');
          }
          setIsLoading(false);
          return;
        }
      }
    }
    
    // Text search (either standalone or fallback from failed image search)
    if (query.trim()) {
      console.log('🔍 Using text search for:', query);
      
      if (activeTab === 'listings') {
        // eBay Browse API for current listings
        await handleEbayBrowseSearch(query);
        return;
      } else {
        // eBay historical search for sold items
        await handleEbaySearch(query);
        return;
      }
    }
    
    setIsLoading(false);
  }, [searchQuery, selectedImage, isImageSearch, activeTab, handleEbayBrowseSearch, addToHistory, deviceId, refreshUsage, router]);

  // eBay search function (extracted from original handleSearch)
  const handleEbaySearch = useCallback(async (query: string) => {
    // Check scan limits for sold items search before processing
    if (deviceId) {
      try {
        const { canScan, reason, usageInfo } = await SubscriptionService.canUserScan(null, deviceId, 'sold_text');
        
        if (!canScan) {
          setSoldError(reason || 'Scan limit exceeded');
          
          // Show subscription upgrade modal/alert
          Alert.alert(
            'Scan Limit Reached',
            `${reason}\n\nUsage: ${usageInfo.used}/${usageInfo.limit === -1 ? '∞' : usageInfo.limit} scans this month`,
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Upgrade', 
                onPress: () => router.push('/subscription') 
              }
            ]
          );
          return;
        }
      } catch (error) {
        console.error('Error checking sold items scan limits:', error);
        // Continue with search if limit check fails
      }
    }
    
    setSoldError('');
    try {
      const ebayRequest = await inferEbayRequestFields(query);
      const data = await fetchEbayCompletedItems(ebayRequest);
      
      if (!data.items || data.items.length === 0) {
        setSoldError('No results found. Try different keywords or check spelling.');
        setSoldResults([]);
        setSoldStats(null);
        setSoldItemFlags([]);
        return;
      }
      
      const items = data.items;
      const mappedResults = items.map(item => mapEbayItemToSearchResult(item, query));
      
      // Calculate stats and flags for eBay results
      const calculation = calculateStatsAndFlags(items);
      const newStats = calculation.stats;
      const newItemFlags = calculation.itemFlags;
      
      // Enhance stats with eBay source information
      const enhancedStats = {
        ...newStats,
        data_source: 'ebay',
      };
      
      setSoldStats(enhancedStats);
      setSoldItemFlags(newItemFlags);
      setSoldResults(mappedResults);
      addRecentSearch(query);
      
      // Record successful sold items scan after search completes
      if (deviceId && mappedResults.length > 0) {
        try {
          await SubscriptionService.recordScan(null, deviceId, 'sold_text', '', {
            searchType: 'sold',
            query,
            resultsFound: mappedResults.length
          });
          console.log('✅ Sold items text scan recorded successfully');
          
          // Refresh usage display
          await refreshUsage();
        } catch (error) {
          console.error('Error recording sold items scan:', error);
        }
      }
      
      // Save to search history
      if (mappedResults.length > 0) {
        const firstResult = mappedResults[0];
        
        // Save the complete SearchResult object with all sold item data  
        const completeHistoryData = {
          ...firstResult, // Include ALL SearchResult data
          query,
          searchType: 'sold' as const,
          // Ensure price is from stats for consistency
          price: enhancedStats?.average_price || firstResult.price,
        };
        
        await addToHistory(completeHistoryData);
      } else {
        const historyData = { 
          query,
          title: query,
          searchType: 'sold' as const,
        };
        await addToHistory(historyData);
      }
    } catch (err) {
      setSoldError('Search failed. Please check your connection and try again.');
      console.error('Search error:', err);
      const historyData = { 
        query,
        title: query,
        searchType: 'sold' as const,
      };
      await addToHistory(historyData);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [addRecentSearch, addToHistory, deviceId, refreshUsage, router]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    handleSearch();
  }, [handleSearch]);

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedImage(null);
    setIsImageSearch(false);
    if (activeTab === 'sold') {
      setSoldResults([]);
      setSoldStats(null);
      setSoldItemFlags([]);
      setSoldError('');
    } else {
      setListingsResults([]);
      setListingsStats(null);
      setListingsItemFlags([]);
      setListingsError('');
    }
  };

  const handleTabSwitch = (tab: 'sold' | 'listings') => {
    setActiveTab(tab);
    setSearchQuery(''); // Clear search query when switching tabs
    setSelectedImage(null); // Clear image when switching tabs
    setIsImageSearch(false); // Reset image search mode
  };

  const handleViewMarketAnalysis = () => {
    setMarketAnalysisModalVisible(true);
  };

  const handleItemPress = (item: SearchResult) => {
    // Since current listing data is now directly on SearchResult object,
    // we don't need to extract from nested items array
    const itemWithContext = {
      ...item,
      isAIResult: stats?.data_source === 'ai_web_search',
      sourceWebsite: item.sourceWebsite,
      searchType: activeTab === 'listings' ? 'current' : 'sold', // Explicitly set search type
    };
    
    router.push({
      pathname: '/item/[id]',
      params: { id: item.itemId, data: JSON.stringify(itemWithContext) }
    });
  };

  const handleRecentSearchPress = (query: string) => {
    setSearchQuery(query);
    // Clear any selected image when using recent search (text search only)
    setSelectedImage(null);
    setIsImageSearch(false);
    
    // Use the appropriate search method based on active tab
    if (activeTab === 'listings') {
      handleEbayBrowseSearch(query);
    } else {
      handleEbaySearch(query);
    }
  };

  const handleIdentifyItem = async () => {
    try {
      Alert.alert(
        'Search with Image',
        'Choose how to search:',
        [
          { text: 'Search Similar Items', onPress: () => pickImageForSearch() },
          { text: 'Identify Item', onPress: () => pickImageForIdentify() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } catch (err) {
      setAiError('Failed to start image picker');
    }
  };

  const handleImageSearchFlow = async () => {
    try {
      Alert.alert(
        'Search with Image',
        'Take a photo or choose from gallery to search for similar items:',
        [
          { text: 'Camera', onPress: () => pickImage('camera') },
          { text: 'Gallery', onPress: () => pickImage('gallery') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to start image search');
    }
  };

  const pickImageForSearch = async () => {
    Alert.alert(
      'Select Image Source',
      'Take a photo or choose from gallery?',
      [
        { text: 'Camera', onPress: () => pickImage('camera') },
        { text: 'Gallery', onPress: () => pickImage('gallery') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const pickImageForIdentify = async () => {
    Alert.alert(
      'Select Image Source',
      'Take a photo or choose from gallery?',
      [
        { text: 'Camera', onPress: () => pickImage('camera', true) },
        { text: 'Gallery', onPress: () => pickImage('gallery', true) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const pickImage = async (source: 'camera' | 'gallery', forIdentification: boolean = false) => {
    try {
      let permissionResult;
      if (source === 'camera') {
        permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert('Permission required', 'Camera permission is required to take a photo.');
          return;
        }
      } else {
        permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
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

      if (result.canceled || !result.assets?.[0]?.base64) {
        return;
      }

      if (forIdentification) {
        // Use eBay's searchByImage for identification
        setAiLoading(true);
        setAiModalVisible(true);
        setAiError('');
        setAiDescription('');
        
        try {
          console.log('🔍 Using eBay Image Search for item identification...');
          const ebayResults = await ebaySearchByImage({
            image: result.assets[0].base64,
            limit: 1
          });
          
          if (ebayResults.itemSummaries && ebayResults.itemSummaries.length > 0) {
            const identifiedTitle = ebayResults.itemSummaries[0].title;
            const simplifiedTitle = await simplifyItemTitle(identifiedTitle);
            console.log('✅ eBay identified item:', identifiedTitle);
            console.log('📝 Simplified title:', simplifiedTitle);
            setAiDescription(simplifiedTitle);
          } else {
            setAiError('Could not identify item. Please try again.');
          }
        } catch (err) {
          console.error('eBay identification error:', err);
          if (err instanceof EbayError) {
            switch (err.type) {
              case EbayErrorType.AUTH_FAILED:
                setAiError('Authentication failed. Please try again later.');
                break;
              case EbayErrorType.INVALID_IMAGE:
                setAiError('Invalid image. Please try a different image.');
                break;
              case EbayErrorType.NO_RESULTS:
                setAiError('Could not identify item. Try a clearer photo.');
                break;
              case EbayErrorType.RATE_LIMIT:
                setAiError('Too many requests. Please wait a moment and try again.');
                break;
              default:
                setAiError('Failed to identify item. Please try again.');
            }
          } else {
            setAiError('Failed to identify item. Please try again.');
          }
        } finally {
          setAiLoading(false);
        }
      } else {
        // Set the image for search
        const imageBase64 = result.assets[0].base64;
        if (!imageBase64) {
          Alert.alert('Error', 'Failed to process image. Please try again.');
          return;
        }
        
        setSelectedImage(imageBase64);
        setIsImageSearch(true);
        setSearchQuery('');
        
        if (activeTab === 'sold') {
          setActiveTab('listings');
        }
        
        // Automatically trigger the AI Web Search directly (bypass the 3-option modal)
        setTimeout(async () => {
          setIsLoading(true);
          try {
            console.log('🔍 Auto-triggering AI Web Search from button...');
            const ebayResults = await ebaySearchByImage({
              image: imageBase64,
              limit: 50
            });
            
            if (ebayResults.itemSummaries && ebayResults.itemSummaries.length > 0) {
              const identifiedTitle = ebayResults.itemSummaries[0].title;
              console.log('✅ eBay identified item:', identifiedTitle);
              
              // Calculate stats from eBay response for Current Listings tab
              const stats = calculateEbayImageSearchStats(ebayResults, 'Image Search');
              
              // Convert eBay results to our expected format for Current Listings tab
              const convertedItems = ebayResults.itemSummaries.map((item) => {
                return {
                  item_id: item.itemId,
                  title: item.title,
                  sale_price: parseFloat(item.price.value) || 0,
                  image_url: item.image?.imageUrl,
                  condition: item.condition || 'Unknown',
                  date_sold: new Date().toISOString(),
                  link: item.itemWebUrl,
                  buying_format: item.buyingOptions?.[0] || 'Current Listing',
                  shipping_price: item.shippingOptions?.[0]?.shippingCost ? parseFloat(item.shippingOptions[0].shippingCost.value) : 0,
                  source_website: 'ebay.com',
                  // Current listings specific data
                  seller: item.seller,
                  additionalImages: item.additionalImages,
                  topRatedBuyingExperience: item.topRatedBuyingExperience,
                  buyingOptions: item.buyingOptions,
                  itemOriginDate: item.itemOriginDate,
                };
              });
              
              const mappedResults = convertedItems.map(item => mapEbayItemToSearchResult(item, 'Image Search'));
              
              // Populate Current Listings tab with the eBay image search results
              setListingsResults(mappedResults);
              setListingsStats(stats);
              setListingsItemFlags(convertedItems.map(() => ({ isOutlier: null, isMostRecent: false })));
              
              console.log('✅ Populated Current Listings tab with', mappedResults.length, 'items');
              
              // Set the search query (use original title for Current Listings)
              setSearchQuery(identifiedTitle);
              
            } else {
              setListingsError('Could not find items matching this image. Please try again.');
            }
          } catch (err) {
            console.error('Auto image search error:', err);
            setListingsError('Failed to search by image. Please try again.');
          }
          setIsLoading(false);
        }, 100);
      }
      
    } catch (err) {
      console.error('pickImage error:', err);
      Alert.alert('Error', 'Something went wrong while picking the image.');
    }
  };

  const handleAiConfirm = async () => {
    const queryToUse = aiDescription;
    setSearchQuery(queryToUse);
    setAiModalVisible(false);
    
    if (activeTab === 'listings') {
      // For listings tab, run AI web search with the confirmed query
      await handleEbayBrowseSearch(queryToUse);
    } else {
      // For sold tab, run eBay historical search with the confirmed query
      await handleEbaySearch(queryToUse);
    }
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
          {/* Tab Selection */}
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tab, { 
                backgroundColor: 'transparent',
                borderColor: activeTab === 'sold' ? tintColor : subtleText,
                borderWidth: 1
              }]}
              onPress={() => handleTabSwitch('sold')}
            >
              <Text style={[styles.tabText, { color: activeTab === 'sold' ? tintColor : subtleText }]}>
                Sold Items
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, { 
                backgroundColor: 'transparent',
                borderColor: activeTab === 'listings' ? tintColor : subtleText,
                borderWidth: 1
              }]}
              onPress={() => handleTabSwitch('listings')}
            >
              <Text style={[styles.tabText, { color: activeTab === 'listings' ? tintColor : subtleText }]}>
              Current Listings
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchInputRow}>
          <View style={[styles.searchInputContainer, { backgroundColor: cardColor, borderColor: borderColor, shadowColor: borderColor } ] }>
              
              {/* Selected Image Preview */}
              {selectedImage && isImageSearch && (
                <View style={styles.imagePreviewContainer}>
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${selectedImage}` }} 
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity 
                    onPress={() => {
                      setSelectedImage(null);
                      setIsImageSearch(false);
                    }}
                    style={styles.removeImageButton}
                  >
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              
            <TextInput
                style={[styles.searchInput, { 
                  color: textColor,
                  opacity: selectedImage && isImageSearch ? 0.5 : 1 
                }]}
                placeholder={
                  selectedImage && isImageSearch 
                    ? "Image selected - tap Search to find similar items" 
                    : activeTab === 'sold' 
                      ? "Search sold items (e.g., iPhone X)" 
                      : "Search current listings with AI"
                }
              placeholderTextColor={subtleText}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => handleSearch()}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
                editable={!isImageSearch} // Disable text input when image is selected
              />
              
              {/* Image picker buttons */}
              {!selectedImage && activeTab === 'listings' && (
                <View style={styles.imagePickerButtons}>
                  <TouchableOpacity 
                    onPress={() => pickImage('camera')}
                    style={styles.imagePickerButton}
                  >
                    <Camera size={18} color={subtleText} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => pickImage('gallery')}
                    style={styles.imagePickerButton}
                  >
                    <ImageIcon size={18} color={subtleText} />
                  </TouchableOpacity>
                </View>
              )}
              
              {(searchQuery.length > 0 || selectedImage) && (
              <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
                <X size={18} color={subtleText} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
              style={[styles.searchButton, { backgroundColor: backgroundColor, borderColor: activeTab === 'sold' ? tintColor : tintColor, borderWidth: 1, shadowColor: activeTab === 'sold' ? tintColor : tintColor, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
            onPress={() => handleSearch()}
              disabled={!searchQuery.trim() && !selectedImage}
            >
              <Text style={[styles.searchButtonText, { color: activeTab === 'sold' ? tintColor : tintColor }]}>
                {selectedImage && isImageSearch
                ?
                  <SearchIcon size={20} color={subtleText} style={styles.searchIcon} />
                :               
                  <SearchIcon size={20} color={tintColor} style={styles.searchIcon} />
                }
              </Text>
          </TouchableOpacity>
          </View>
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
                      purchasePrice={purchasePrice && !isNaN(parseFloat(purchasePrice)) ? parseFloat(purchasePrice) : undefined} 
                      searchTitle={searchQuery} 
                      onViewAnalysis={stats?.data_source === 'ai_web_search' ? handleViewMarketAnalysis : undefined}
                      selectedImage={isImageSearch && selectedImage !== null ? selectedImage : undefined}
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
                      title: item.title || 'Unknown Item',
                      sale_price: typeof item.price === 'number' ? item.price : (typeof item.price === 'string' ? parseFloat(item.price) : 0),
                      image_url: item.image || undefined,
                      condition: typeof item.condition === 'string' ? item.condition : undefined,
                      date_sold: item.timestamp || new Date().toISOString(),
                      buying_format: typeof item.buyingFormat === 'string' ? item.buyingFormat : undefined,
                      shipping_price: item.shipping || undefined,
                      link: item.url || undefined,
                      // Current listings specific data
                      seller: item.seller,
                      additionalImages: item.additionalImages,
                      topRatedBuyingExperience: item.topRatedBuyingExperience,
                      buyingOptions: item.buyingOptions,
                      itemOriginDate: item.itemOriginDate,
                    }}
                    onPress={() => handleItemPress(item)}
                    isOutlier={itemFlags[index]?.isOutlier || null}
                    isMostRecent={itemFlags[index]?.isMostRecent || false}
                    purchasePrice={purchasePrice && !isNaN(parseFloat(purchasePrice)) ? parseFloat(purchasePrice) : undefined}
                    isAIResult={stats?.data_source === 'ai_web_search'}
                    sourceWebsite={typeof item.sourceWebsite === 'string' ? item.sourceWebsite : undefined}
                    isCurrentListing={activeTab === 'listings'}
                  />
                </Animated.View>
              );
            }}
            contentContainerStyle={styles.resultsContainer}
          />
        ) : searchQuery.trim() && !isLoading ? (
          <EmptyState
            title="No Results Found"
            description="Try using different keywords or check your spelling"
            icon="Search"
          />
        ) : null}

        <TouchableOpacity 
          style={[styles.searchButton, { marginHorizontal: 16, marginBottom: 8, borderWidth: 1, backgroundColor: backgroundColor, borderColor: tintColor }]}
          onPress={activeTab === 'sold' ? handleIdentifyItem : handleImageSearchFlow}
        >
          <Text style={[styles.searchButtonText, { color: tintColor }]}>
            {activeTab === 'sold' ? 'Identify item by image with AI' : 'Search with image'}
          </Text>
        </TouchableOpacity>

        {/* Tab-specific information */}
        {!isLoading && !results.length && !error && (
          <View style={[styles.tabInfoContainer, { marginHorizontal: 16, marginBottom: 8 }]}>
            {activeTab === 'sold' ? (
              <View style={[styles.infoCard, { backgroundColor: cardColor, borderColor: tintColor }]}>
                <Text style={[styles.infoTitle, { color: textColor }]}>📊 Historical Sales Data</Text>
                <Text style={[styles.infoText, { color: subtleText }]}>
                  Search completed sales to see what items actually sold for. Perfect for understanding market value and pricing trends.
                </Text>
              </View>
            ) : (
              <View style={[styles.infoCard, { backgroundColor: cardColor, borderColor: tintColor }]}>
                <Text style={[styles.infoTitle, { color: textColor }]}>🛒 Current eBay Listings</Text>
                <Text style={[styles.infoText, { color: subtleText }]}>
                  Search live eBay listings to see current market pricing and availability. Find items you can buy right now with real seller information and shipping details.
                  <Text style={{ fontWeight: 'bold', color: tintColor }}> Tip:</Text> Use image search for better results or add text descriptions for specific items.
                </Text>
              </View>
            )}
          </View>
        )}

        <Modal
          visible={aiModalVisible || aiLoading}
          animationType="slide"
          transparent={true}
          onRequestClose={() => { if (!aiLoading) setAiModalVisible(false); }}
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <View style={{ backgroundColor: cardColor, borderRadius: 12, padding: 24, width: '100%', alignItems: 'center' }}>
              {aiLoading ? (
                <>
                  <ActivityIndicator size="large" color={tintColor} />
                  <Text style={{ fontSize: 16, marginTop: 16, color: subtleText }}>Identifying item...</Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: textColor }}>AI Identification</Text>
                  <Text style={{ fontSize: 12, marginBottom: 12, color: subtleText, marginTop: 4, textAlign: 'center' }}>You can manually enter a description below.  If the item does not return any results, try a different description in the search bar!</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: borderColor, borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 16, width: '100%', color: textColor }}
                    value={aiDescription}
                    onChangeText={setAiDescription}
                    multiline
                    placeholderTextColor={subtleText}
                  />
                  {aiError ? <Text style={{ color: errorColor, marginBottom: 8 }}>{aiError}</Text> : null}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                    <Button title="Cancel" onPress={() => setAiModalVisible(false)} color={subtleText} />
                    <View style={{ width: 12 }} />
                      <View style={{ flexDirection: 'row'}}>
                      <TouchableOpacity  onPress={handleAiConfirm} disabled={!aiDescription.trim()} style={{ backgroundColor: 'transparent', borderWidth: 1, borderColor: tintColor, padding: 10, borderRadius: 8 }}>
                            <Text style={{ color: tintColor, textAlign: 'center' }}>Search</Text>
                          </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Market Analysis Modal */}
        <Modal
          visible={marketAnalysisModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setMarketAnalysisModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ 
              flex: 1, 
              marginTop: '20%', 
              backgroundColor: cardColor, 
              borderTopLeftRadius: 20, 
              borderTopRightRadius: 20,
              padding: 24
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: textColor }}>📊 Market Analysis</Text>
                <TouchableOpacity onPress={() => setMarketAnalysisModalVisible(false)}>
                  <Text style={{ fontSize: 18, color: tintColor, fontWeight: 'bold' }}>Done</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView showsVerticalScrollIndicator={false}>
                <Markdown 
                  style={{
                    body: {
                      fontSize: 16,
                      lineHeight: 24,
                      color: textColor,
                      fontFamily: 'Inter_400Regular'
                    },
                    heading1: {
                      fontSize: 24,
                      fontWeight: 'bold',
                      color: textColor,
                      marginBottom: 12,
                      fontFamily: 'Inter_600SemiBold'
                    },
                    heading2: {
                      fontSize: 20,
                      fontWeight: 'bold',
                      color: textColor,
                      marginBottom: 10,
                      marginTop: 16,
                      fontFamily: 'Inter_600SemiBold'
                    },
                    heading3: {
                      fontSize: 18,
                      fontWeight: 'bold',
                      color: textColor,
                      marginBottom: 8,
                      marginTop: 12,
                      fontFamily: 'Inter_600SemiBold'
                    },
                    paragraph: {
                      fontSize: 16,
                      lineHeight: 24,
                      color: textColor,
                      marginBottom: 12,
                      fontFamily: 'Inter_400Regular'
                    },
                    listItem: {
                      fontSize: 16,
                      lineHeight: 22,
                      color: textColor,
                      marginBottom: 6,
                      fontFamily: 'Inter_400Regular'
                    },
                    strong: {
                      fontWeight: 'bold',
                      color: textColor,
                      fontFamily: 'Inter_600SemiBold'
                    },
                    em: {
                      fontStyle: 'italic',
                      color: textColor,
                      fontFamily: 'Inter_400Regular'
                    },
                    bullet_list: {
                      marginBottom: 12
                    },
                    ordered_list: {
                      marginBottom: 12
                    },
                    list_item: {
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      marginBottom: 4
                    }
                  }}
                >
                  {stats?.market_summary || 'No market analysis available.'}
                </Markdown>
              </ScrollView>
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
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 8,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 12,
    marginRight: 0,
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
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tab: {
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
  },
  tabText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  tabInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoCard: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  infoTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    marginBottom: 12,
  },
  infoText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  imagePreviewContainer: {
    position: 'relative',
    width: 80,
    height: 36,
    marginRight: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 2,
  },
  imagePickerButtons: {
    flexDirection: 'row',
    marginRight: 8,
  },
  imagePickerButton: {
    padding: 6,
    marginLeft: 4,
  },
});
