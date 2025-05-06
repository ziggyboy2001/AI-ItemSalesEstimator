import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, SafeAreaView, Image, ScrollView, TouchableOpacity, Share, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { X, Share2, Bookmark, BookmarkCheck, DollarSign, ExternalLink, ShoppingBag } from 'lucide-react-native';

import { useSavedItems } from '@/hooks/useSavedItems';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { getSimilarItems, calculateResaleEstimate } from '@/services/ebayApi';
import Colors from '@/constants/Colors';

const { width } = Dimensions.get('window');

export default function ItemDetailScreen() {
  const { id, data } = useLocalSearchParams();
  const [item, setItem] = useState(null);
  const [similarItems, setSimilarItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resaleEstimate, setResaleEstimate] = useState(null);
  
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { savedItems, addToSaved, removeFromSaved } = useSavedItems();
  const { addToHistory } = useSearchHistory();
  
  const isSaved = savedItems.some(item => item?.itemId === id);

  useEffect(() => {
    if (data) {
      try {
        const parsedItem = typeof data === 'string' ? JSON.parse(data) : data;
        setItem(parsedItem);
        
        // Add to history
        if (parsedItem.query) {
          addToHistory({
            id: Date.now(),
            itemId: parsedItem.itemId,
            query: parsedItem.query,
            title: parsedItem.title,
            timestamp: new Date().toISOString(),
            ...parsedItem
          });
        }
        
        // Load similar items
        const loadSimilarItems = async () => {
          try {
            const similar = await getSimilarItems(parsedItem.title);
            setSimilarItems(similar);
            
            // Calculate resale estimate
            const estimate = calculateResaleEstimate(parsedItem, similar);
            setResaleEstimate(estimate);
          } catch (error) {
            console.error('Error loading similar items:', error);
          } finally {
            setIsLoading(false);
          }
        };
        
        loadSimilarItems();
      } catch (e) {
        console.error('Error parsing item data:', e);
        setIsLoading(false);
      }
    }
  }, [data, id, addToHistory]);

  const handleShare = async () => {
    if (!item) return;
    
    try {
      await Share.share({
        message: `Check out this ${item.title} on eBay! Estimated resale value: ${resaleEstimate?.formattedEstimate || 'Calculating...'}`,
        url: item.url || `https://www.ebay.com/itm/${item.itemId}`
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleToggleSave = () => {
    if (isSaved) {
      removeFromSaved(id);
    } else if (item) {
      addToSaved(item);
    }
  };

  const handleOpenInBrowser = () => {
    if (item?.url) {
      // In a full implementation, this would use Linking.openURL or expo-web-browser
      console.log(`Opening in browser: ${item.url}`);
    }
  };

  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return typeof price === 'string' ? price : `$${price.toFixed(2)}`;
  };

  if (!item) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
        <Text style={styles.loadingText}>Loading item details...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <X size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Share2 size={22} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleToggleSave}>
            {isSaved ? (
              <BookmarkCheck size={22} color={Colors.light.tint} />
            ) : (
              <Bookmark size={22} color="#333" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeIn.duration(400)}>
          {item.image && (
            <Image 
              source={{ uri: item.image }} 
              style={styles.itemImage} 
              resizeMode="contain"
            />
          )}
        </Animated.View>

        <Animated.View style={styles.itemDetails} entering={FadeInDown.delay(100).duration(400)}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.currentPrice}>
              {formatPrice(item.price)}
            </Text>
            {item.originalPrice && (
              <Text style={styles.originalPrice}>
                {formatPrice(item.originalPrice)}
              </Text>
            )}
          </View>

          {item.condition && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Condition:</Text>
              <Text style={styles.infoValue}>{item.condition}</Text>
            </View>
          )}

          {resaleEstimate ? (
            <Animated.View 
              style={styles.estimateContainer} 
              entering={FadeInDown.delay(200).duration(500)}
            >
              <View style={styles.estimateHeader}>
                <DollarSign size={20} color="#fff" />
                <Text style={styles.estimateTitle}>Estimated Resale Value</Text>
              </View>
              <Text style={styles.estimateValue}>
                {resaleEstimate.formattedEstimate}
              </Text>
              <Text style={styles.estimateRange}>
                Range: {resaleEstimate.formattedMin} - {resaleEstimate.formattedMax}
              </Text>
              <Text style={styles.estimateNote}>
                Based on {resaleEstimate.similarItemsCount} similar {resaleEstimate.similarItemsCount === 1 ? 'item' : 'items'}
              </Text>
            </Animated.View>
          ) : isLoading ? (
            <View style={styles.loadingEstimate}>
              <ActivityIndicator size="small" color={Colors.light.tint} />
              <Text style={styles.loadingEstimateText}>Calculating estimate...</Text>
            </View>
          ) : null}

          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.viewOnEbayButton} 
              onPress={handleOpenInBrowser}
            >
              <ExternalLink size={18} color="#fff" />
              <Text style={styles.viewOnEbayText}>View on eBay</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {similarItems.length > 0 && (
          <Animated.View 
            style={styles.similarItemsSection}
            entering={FadeInDown.delay(300).duration(400)}
          >
            <Text style={styles.sectionTitle}>Similar Items</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similarItemsContainer}
            >
              {similarItems.map((similarItem, index) => (
                <TouchableOpacity 
                  key={`${similarItem.itemId}-${index}`}
                  style={styles.similarItemCard}
                  onPress={() => router.push({
                    pathname: `/item/${similarItem.itemId}`,
                    params: { data: JSON.stringify(similarItem) }
                  })}
                >
                  {similarItem.image ? (
                    <Image 
                      source={{ uri: similarItem.image }} 
                      style={styles.similarItemImage} 
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.noImageContainer}>
                      <ShoppingBag size={24} color="#ccc" />
                    </View>
                  )}
                  <Text style={styles.similarItemTitle} numberOfLines={2}>
                    {similarItem.title}
                  </Text>
                  <Text style={styles.similarItemPrice}>
                    {formatPrice(similarItem.price)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
    zIndex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  itemImage: {
    width: width,
    height: width * 0.8,
    backgroundColor: '#f8f8f8',
  },
  itemDetails: {
    padding: 16,
  },
  itemTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: '#111',
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentPrice: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: '#111',
  },
  originalPrice: {
    fontFamily: 'Inter_400Regular',
    fontSize: 18,
    color: '#999',
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: '#666',
    width: 100,
  },
  infoValue: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  estimateContainer: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  estimateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  estimateTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#fff',
    marginLeft: 6,
  },
  estimateValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    color: '#fff',
    marginBottom: 4,
  },
  estimateRange: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  estimateNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  loadingEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  loadingEstimateText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  viewOnEbayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e43137', // eBay red
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
  },
  viewOnEbayText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#fff',
    marginLeft: 8,
  },
  similarItemsSection: {
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: '#111',
    marginBottom: 12,
  },
  similarItemsContainer: {
    paddingBottom: 16,
  },
  similarItemCard: {
    width: 160,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
  },
  similarItemImage: {
    width: '100%',
    height: 130,
    backgroundColor: '#f8f8f8',
  },
  noImageContainer: {
    width: '100%',
    height: 130,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  similarItemTitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#333',
    padding: 8,
    paddingBottom: 4,
    height: 56,
  },
  similarItemPrice: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#111',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
});