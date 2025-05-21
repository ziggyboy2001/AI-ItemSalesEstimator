import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, SafeAreaView, Image, ScrollView, TouchableOpacity, Share, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { X, Share2, Bookmark, BookmarkCheck, DollarSign, ExternalLink, ShoppingBag, SearchIcon } from 'lucide-react-native';

import { useSavedItems } from '@/hooks/useSavedItems';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useThemeColor } from '@/constants/useThemeColor';

const { width } = Dimensions.get('window');

type ItemType = {
  itemId: string;
  title: string;
  price: number | string;
  image?: string;
  condition?: string;
  timestamp?: string;
  url?: string;
  originalPrice?: number | string;
  query?: string;
  [key: string]: any;
};

export default function ItemDetailScreen() {
  const { id, data } = useLocalSearchParams();
  const [item, setItem] = useState<ItemType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { savedItems, addToSaved, removeFromSaved } = useSavedItems();
  const { addToHistory } = useSearchHistory();

  // THEME COLORS
  const backgroundColor = useThemeColor('background');
  const cardColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const subtleText = useThemeColor('tabIconDefault');
  const tintColor = useThemeColor('tint');
  const errorColor = useThemeColor('error');

  const isSaved = savedItems.some(saved => saved?.itemId === id);

  useEffect(() => {
    if (data) {
      try {
        const parsedItem = typeof data === 'string' ? JSON.parse(data) : data;
        setItem(parsedItem);
        // Add to history
        if (parsedItem.query) {
          addToHistory({
            itemId: parsedItem.itemId,
            query: parsedItem.query,
            title: parsedItem.title,
            image: parsedItem.image || parsedItem.image_url,
            link: parsedItem.url,
            price: parsedItem.price,
          });
        }
      } catch (e) {
        console.error('Error parsing item data:', e);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [data, id, addToHistory]);

  // Debug log for price
  useEffect(() => {
    if (item) {
      console.log('[ItemDetailScreen] item.price:', item.price, typeof item.price);
    }
  }, [item]);

  const handleShare = async () => {
    if (!item) return;
    try {
      await Share.share({
        message: `Check out this ${item.title} on eBay!`,
        url: item.url || `https://www.ebay.com/itm/${item.itemId}`
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleToggleSave = () => {
    if (!item) return;
    if (isSaved) {
      removeFromSaved(item.itemId);
    } else {
      addToSaved(item);
    }
  };

  const handleOpenInBrowser = () => {
    if (item?.url) {
      // In a full implementation, this would use Linking.openURL or expo-web-browser
      console.log(`Opening in browser: ${item.url}`);
    }
  };

  const formatPrice = (price: number | string | undefined) => {
    if (!price) return 'N/A';
    return typeof price === 'string' ? price : `$${price.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor }]}> 
        <ActivityIndicator size="large" color={tintColor} />
        <Text style={[styles.loadingText, { color: subtleText }]}>Loading item details...</Text>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor }]}> 
        <Text style={[styles.loadingText, { color: errorColor }]}>Item not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor }]}> 
      <View style={[styles.header, { backgroundColor: cardColor }]}> 
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <X size={24} color={subtleText} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Share2 size={22} color={subtleText} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleToggleSave}>
            {isSaved ? (
              <BookmarkCheck size={22} color={tintColor} />
            ) : (
              <Bookmark size={22} color={subtleText} />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeIn.duration(400)}>
          {(item.image || item.image_url) ? (
            <Image 
              source={{ uri: item.image || item.image_url }} 
              style={styles.itemImage} 
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.itemImage, { justifyContent: 'center', alignItems: 'center' }]}> 
              <ShoppingBag size={48} color={subtleText} />
            </View>
          )}
        </Animated.View>
        <Animated.View style={styles.itemDetails} entering={FadeInDown.delay(100).duration(400)}>
          <Text style={[styles.itemTitle, { color: textColor }]}>{item.title}</Text>
          <View style={styles.priceContainer}>
            <Text style={[styles.currentPrice, { color: tintColor }]}> 
              {(() => {
                if (item.price !== undefined && item.price !== null && item.price !== '' && !isNaN(Number(item.price))) {
                  return typeof item.price === 'number' ? `$${item.price.toFixed(2)}` : `$${Number(item.price).toFixed(2)}`;
                } else {
                  console.warn('[ItemDetailScreen] Invalid price:', item.price);
                  return '$0.00';
                }
              })()}
            </Text>
            {item.originalPrice && (
              <Text style={[styles.originalPrice, { color: subtleText }]}> 
                {formatPrice(item.originalPrice)}
              </Text>
            )}
          </View>
          {item.condition && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: subtleText }]}>Condition:</Text>
              <Text style={[styles.infoValue, { color: textColor }]}>{item.condition}</Text>
            </View>
          )}
          {item.timestamp && (() => {
            console.log('timestamp (raw):', item.timestamp);
            let date: Date | null = null;
            if (typeof item.timestamp === 'number') {
              date = new Date(item.timestamp);
            } else if (typeof item.timestamp === 'string') {
              date = new Date(item.timestamp);
              if (isNaN(date.getTime())) {
                // Try parsing as milliseconds
                const ms = parseInt(item.timestamp, 10);
                if (!isNaN(ms)) date = new Date(ms);
              }
            }
            // console.log('timestamp (parsed):', date);
            return (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: subtleText }]}>Sold At:</Text>
                <Text style={[styles.infoValue, { color: textColor }]}> 
                  {date && !isNaN(date.getTime())
                    ? date.toLocaleString()
                    : (typeof item.timestamp === 'string' ? item.timestamp : 'Unknown')}
                </Text>
              </View>
            );
          })()}
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={[styles.viewOnEbayButton, { backgroundColor: tintColor }]} 
              onPress={handleOpenInBrowser}
            >
              <ExternalLink size={18} color="#fff" />
              <Text style={styles.viewOnEbayText}>View on eBay</Text>
            </TouchableOpacity>
            {/* Re-Search Button */}
            {item.query && (
              <TouchableOpacity
                style={[styles.viewOnEbayButton, { backgroundColor: subtleText, marginTop: 8 }]}
                onPress={() => router.push({ pathname: '/', params: { q: item.query } })}
              >
                <SearchIcon size={18} color="#fff" />
                <Text style={styles.viewOnEbayText}>Re-Search</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
  },
  itemDetails: {
    padding: 16,
  },
  itemTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
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
    marginRight: 8,
  },
  originalPrice: {
    fontFamily: 'Inter_400Regular',
    fontSize: 18,
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
    width: 100,
  },
  infoValue: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    flex: 1,
  },
  actionsContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    marginTop: 16,
  },
  viewOnEbayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
  },
  viewOnEbayText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#fff',
    marginLeft: 8,
  },
});