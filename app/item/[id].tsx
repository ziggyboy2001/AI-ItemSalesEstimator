import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, SafeAreaView, Image, ScrollView, TouchableOpacity, Share, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { X, Share2, Bookmark, BookmarkCheck, DollarSign, TrendingUp, Calendar, Tag, ShoppingBag, SearchIcon, Copy, AlertCircle } from 'lucide-react-native';

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
  sourceWebsite?: string;
  isAIResult?: boolean;
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
  const successColor = useThemeColor('success');

  const isSaved = savedItems.some(saved => saved?.itemId === id);
  const isAIResult = item?.isAIResult || item?.sourceWebsite;

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

  const handleShare = async () => {
    if (!item) return;
    try {
      await Share.share({
        message: `Check out this ${item.title} - ${formatPrice(item.price)}`,
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

  const handleCopyTitle = () => {
    if (item?.title) {
      // In a real app, you'd use Clipboard.setString(item.title)
      Alert.alert('Copied!', 'Item title copied to clipboard');
    }
  };

  const handleNewSearch = () => {
    router.push('/(tabs)/');
  };

  const formatPrice = (price: number | string | undefined) => {
    if (!price) return 'N/A';
    if (typeof price === 'number') return `$${price.toFixed(2)}`;
    if (typeof price === 'string' && !isNaN(Number(price))) return `$${Number(price).toFixed(2)}`;
    return price;
  };

  const formatDate = (timestamp: string | undefined) => {
    if (!timestamp) return 'Unknown';
    
    try {
      let date: Date;
      if (typeof timestamp === 'number') {
        date = new Date(timestamp);
      } else {
        date = new Date(timestamp);
        if (isNaN(date.getTime())) {
          const ms = parseInt(timestamp, 10);
          if (!isNaN(ms)) date = new Date(ms);
        }
      }
      
      if (isNaN(date.getTime())) return timestamp;
      
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      
      return date.toLocaleDateString();
    } catch {
      return timestamp || 'Unknown';
    }
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
        <AlertCircle size={48} color={errorColor} />
        <Text style={[styles.loadingText, { color: errorColor, marginTop: 16 }]}>Item not found</Text>
        <TouchableOpacity 
          style={[styles.backToSearchButton, { backgroundColor: tintColor, marginTop: 20 }]}
          onPress={handleNewSearch}
        >
          <SearchIcon size={20} color="#fff" />
          <Text style={styles.backToSearchText}>Back to Search</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}> 
      {/* Header */}
      <Animated.View 
        style={[styles.header, { backgroundColor: cardColor }]}
        entering={FadeInUp.duration(300)}
      > 
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <X size={24} color={textColor} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Share2 size={22} color={subtleText} />
          </TouchableOpacity>
          {/* <TouchableOpacity style={styles.actionButton} onPress={handleToggleSave}>
            {isSaved ? (
              <BookmarkCheck size={22} color={tintColor} />
            ) : (
              <Bookmark size={22} color={subtleText} />
            )}
          </TouchableOpacity> */}
        </View>
      </Animated.View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Image Section */}
        <Animated.View 
          style={styles.imageContainer}
          entering={FadeIn.duration(400)}
        >
          {(item.image || item.image_url) ? (
            <Image 
              source={{ uri: item.image || item.image_url }} 
              style={styles.itemImage} 
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.itemImagePlaceholder, { backgroundColor: cardColor }]}> 
              <ShoppingBag size={64} color={subtleText} />
              <Text style={[styles.noImageText, { color: subtleText }]}>No image available</Text>
            </View>
          )}
          
          {/* Source Badge */}
          {isAIResult && (
            <View style={[styles.sourceBadge, { backgroundColor: tintColor }]}>
              <Text style={styles.sourceBadgeText}>
                {item.sourceWebsite || 'Live Listing'}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Item Details */}
        <Animated.View 
          style={[styles.itemDetails, { backgroundColor: cardColor }]} 
          entering={FadeInDown.delay(100).duration(400)}
        >
          {/* Title */}
          <TouchableOpacity onPress={handleCopyTitle} activeOpacity={0.7}>
            <Text style={[styles.itemTitle, { color: textColor }]}>{item.title}</Text>
            <View style={styles.copyHint}>
              <Copy size={14} color={subtleText} />
              <Text style={[styles.copyHintText, { color: subtleText }]}>Tap to copy</Text>
            </View>
          </TouchableOpacity>

          {/* Price Section */}
          <View style={[styles.priceCard, { backgroundColor: backgroundColor }]}>
            <View style={styles.priceHeader}>
              <DollarSign size={24} color={tintColor} />
              <Text style={[styles.priceLabel, { color: textColor }]}>
                {isAIResult ? 'Current Price' : 'Sold Price'}
              </Text>
            </View>
            <Text style={[styles.currentPrice, { color: tintColor }]}>
              {formatPrice(item.price)}
            </Text>
            {isAIResult && (
              <Text style={[styles.priceNote, { color: subtleText }]}>
                Live marketplace pricing
              </Text>
            )}
          </View>

          {/* Info Cards */}
          <View style={styles.infoGrid}>
            {item.condition && (
              <Animated.View 
                style={[styles.infoCard, { backgroundColor: backgroundColor }]}
                entering={FadeInDown.delay(200).duration(400)}
              >
                <Tag size={20} color={tintColor} />
                <Text style={[styles.infoCardLabel, { color: subtleText }]}>Condition</Text>
                <Text style={[styles.infoCardValue, { color: textColor }]}>{item.condition}</Text>
              </Animated.View>
            )}

            <Animated.View 
              style={[styles.infoCard, { backgroundColor: backgroundColor }]}
              entering={FadeInDown.delay(250).duration(400)}
            >
              <Calendar size={20} color={tintColor} />
              <Text style={[styles.infoCardLabel, { color: subtleText }]}>
                {isAIResult ? 'Date Found' : 'Date Sold'}
              </Text>
              <Text style={[styles.infoCardValue, { color: textColor }]}>
                {formatDate(item.timestamp)}
              </Text>
            </Animated.View>

            {isAIResult && item.sourceWebsite && (
              <Animated.View 
                style={[styles.infoCard, { backgroundColor: backgroundColor }]}
                entering={FadeInDown.delay(300).duration(400)}
              >
                <TrendingUp size={20} color={tintColor} />
                <Text style={[styles.infoCardLabel, { color: subtleText }]}>Source</Text>
                <Text style={[styles.infoCardValue, { color: textColor }]}>{item.sourceWebsite}</Text>
              </Animated.View>
            )}
          </View>

          {/* Action Buttons */}
          <Animated.View 
            style={styles.actionsContainer}
            entering={FadeInDown.delay(350).duration(400)}
          >
            {/* Disclaimer for external links */}
            <View style={[styles.disclaimerCard, { backgroundColor: backgroundColor }]}>
              <AlertCircle size={16} color={subtleText} />
              <Text style={[styles.disclaimerText, { color: subtleText }]}>
                {isAIResult 
                  ? "This listing is from an external marketplace. Prices and availability may have changed."
                  : "This item was sold on eBay. Use this data for market research and pricing guidance."
                }
              </Text>
            </View>

            {/* {item.query && (
              <TouchableOpacity
                style={[styles.primaryActionButton, { backgroundColor: tintColor }]}
                onPress={() => router.push({ pathname: '/(tabs)/', params: { q: item.query } })}
              >
                <SearchIcon size={20} color="#fff" />
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>Search Similar Items</Text>
              </TouchableOpacity>
            )} */}
{/* 
            <TouchableOpacity
              style={[styles.secondaryActionButton, { borderColor: tintColor }]}
              onPress={handleNewSearch}
            >
              <SearchIcon size={20} color={tintColor} />
              <Text style={[styles.actionButtonText, { color: tintColor }]}>New Search</Text>
            </TouchableOpacity> */}
          </Animated.View>
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
  imageContainer: {
    width: width,
    height: width * 0.8,
    position: 'relative',
  },
  itemImage: {
    width: width,
    height: width * 0.8,
    backgroundColor: 'transparent',
  },
  itemImagePlaceholder: {
    width: width,
    height: width * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    marginTop: 12,
  },
  sourceBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sourceBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#fff',
  },
  itemDetails: {
    padding: 16,
  },
  itemTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    marginBottom: 8,
  },
  copyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  copyHintText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginLeft: 4,
  },
  priceCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    marginBottom: 20,
  },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    marginLeft: 8,
  },
  currentPrice: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    marginBottom: 4,
  },
  priceNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    fontStyle: 'italic',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    gap: 12,
  },
  infoCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    alignItems: 'center',
  },
  infoCardLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  infoCardValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    textAlign: 'center',
  },
  actionsContainer: {
    gap: 12,
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 16,
  },
  disclaimerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
  actionButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    marginLeft: 8,
  },
  backToSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  backToSearchText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#fff',
    marginLeft: 8,
  },
});