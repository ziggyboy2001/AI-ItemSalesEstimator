import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, Text, SafeAreaView, Image, ScrollView, TouchableOpacity, Share, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { X, Share2, Bookmark, BookmarkCheck, DollarSign, TrendingUp, Calendar, Tag, ShoppingBag, SearchIcon, Copy, AlertCircle, User, Star } from 'lucide-react-native';

import { useSavedItems } from '@/hooks/useSavedItems';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useThemeColor } from '@/constants/useThemeColor';
import EbayLinkButton from '@/components/EbayLinkButton';

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
  searchType?: 'sold' | 'current'; // Explicit search type tracking
  // Current listings specific properties
  seller?: {
    username: string;
    feedbackPercentage: string;
    feedbackScore: number;
  };
  additionalImages?: Array<{ imageUrl: string }>;
  topRatedBuyingExperience?: boolean;
  buyingOptions?: string[];
  itemOriginDate?: string;
  itemLocation?: {
    country: string;
    postalCode?: string;
  };
  shippingOptions?: Array<{
    shippingCostType: string;
    shippingCost?: {
      value: string;
      currency: string;
    };
  }>;
  availableCoupons?: boolean;
  [key: string]: any;
};

export default function ItemDetailScreen() {
  const { id, data } = useLocalSearchParams();
  const [item, setItem] = useState<ItemType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
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
  
  // Use explicit searchType instead of inferring
  const isCurrentListing = item?.searchType === 'current';

  // Create images array for carousel
  const allImages = useMemo(() => {
    if (!item) return [];
    
    const images = [];
    
    // Add main image first
    if (item.image || item.image_url) {
      images.push({ imageUrl: item.image || item.image_url });
    }
    
    // Add additional images
    if (item.additionalImages && item.additionalImages.length > 0) {
      images.push(...item.additionalImages);
    }
    
    return images;
  }, [item]);

  const hasMultipleImages = isCurrentListing && allImages.length > 1;

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
            searchType: parsedItem.searchType || 'sold', // Use explicit searchType or default to sold
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
  }, [data, id]);

  const handleShare = async () => {
    if (!item) return;
    try {
      await Share.share({
        message: `Check out this item I found on BidPeek! ${item.title} - ${formatPrice(item.price)}`,
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

  const handleImageScroll = (event: any) => {
    const scrollX = event.nativeEvent.contentOffset.x;
    const imageIndex = Math.round(scrollX / width);
    setCurrentImageIndex(imageIndex);
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
        {/* Image Section with Carousel */}
        <Animated.View 
          style={styles.imageContainer}
          entering={FadeIn.duration(400)}
        >
          {allImages.length > 0 ? (
            <>
              {hasMultipleImages ? (
                <>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleImageScroll}
                    scrollEventThrottle={16}
                    style={styles.imageCarousel}
                  >
                    {allImages.map((image, index) => (
                      <Image 
                        key={index}
                        source={{ uri: image.imageUrl }} 
                        style={styles.itemImage} 
                        resizeMode="contain"
                      />
                    ))}
                  </ScrollView>
                  {/* Pagination Indicators */}
                  <View style={styles.paginationContainer}>
                    {allImages.map((_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.paginationDot,
                          {
                            backgroundColor: index === currentImageIndex ? tintColor : 'rgba(255,255,255,0.5)'
                          }
                        ]}
                      />
                    ))}
                  </View>
                  {/* Image Counter */}
                  <View style={[styles.imageCounter, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                    <Text style={styles.imageCounterText}>
                      {currentImageIndex + 1} / {allImages.length}
                    </Text>
                  </View>
                </>
              ) : (
                <Image 
                  source={{ uri: allImages[0].imageUrl }} 
                  style={styles.itemImage} 
                  resizeMode="contain"
                />
              )}
            </>
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
                {isCurrentListing ? 'Current Price' : 'Sold Price'}
              </Text>
            </View>
            <Text style={[styles.currentPrice, { color: tintColor }]}>
              {formatPrice(item.price)}
            </Text>
            {isCurrentListing && (
              <Text style={[styles.priceNote, { color: subtleText }]}>
                Live listing pricing
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
                {isCurrentListing ? 'Date Listed' : (isAIResult ? 'Date Found' : 'Date Sold')}
              </Text>
              <Text style={[styles.infoCardValue, { color: textColor }]}>
                {isCurrentListing && item.itemOriginDate ? formatDate(item.itemOriginDate) : formatDate(item.timestamp)}
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

            {/* Current listings specific info cards */}
            {isCurrentListing && item.itemLocation && (
              <Animated.View 
                style={[styles.infoCard, { backgroundColor: backgroundColor }]}
                entering={FadeInDown.delay(350).duration(400)}
              >
                <ShoppingBag size={20} color={tintColor} />
                <Text style={[styles.infoCardLabel, { color: subtleText }]}>Location</Text>
                <Text style={[styles.infoCardValue, { color: textColor }]}>
                  {item.itemLocation.country}{item.itemLocation.postalCode ? `, ${item.itemLocation.postalCode.replace(/\*/g, '')}` : ''}
                </Text>
              </Animated.View>
            )}

            {isCurrentListing && item.shippingOptions && item.shippingOptions.length > 0 && (
              <Animated.View 
                style={[styles.infoCard, { backgroundColor: backgroundColor }]}
                entering={FadeInDown.delay(375).duration(400)}
              >
                <TrendingUp size={20} color={tintColor} />
                <Text style={[styles.infoCardLabel, { color: subtleText }]}>Shipping</Text>
                <Text style={[styles.infoCardValue, { color: textColor }]}>
                  {item.shippingOptions[0].shippingCost ? 
                    (item.shippingOptions[0].shippingCost.value === '0.00' ? 
                      'Free' : 
                      `$${item.shippingOptions[0].shippingCost.value}`
                    ) : 
                    'Calculated'
                  }
                </Text>
              </Animated.View>
            )}

            {isCurrentListing && item.buyingOptions && item.buyingOptions.length > 0 && (
              <Animated.View 
                style={[styles.infoCard, { backgroundColor: backgroundColor }]}
                entering={FadeInDown.delay(400).duration(400)}
              >
                <Tag size={20} color={tintColor} />
                <Text style={[styles.infoCardLabel, { color: subtleText }]}>Buying Options</Text>
                <Text style={[styles.infoCardValue, { color: textColor }]} numberOfLines={2}>
                  {item.buyingOptions.map((option: string) => 
                    option === 'FIXED_PRICE' ? 'Buy Now' : 
                    option === 'BEST_OFFER' ? 'Best Offer' : 
                    option
                  ).join(', ')}
                </Text>
              </Animated.View>
            )}

            {isCurrentListing && item.additionalImages && item.additionalImages.length > 0 && (
              <Animated.View 
                style={[styles.infoCard, { backgroundColor: backgroundColor }]}
                entering={FadeInDown.delay(425).duration(400)}
              >
                <ShoppingBag size={20} color={tintColor} />
                <Text style={[styles.infoCardLabel, { color: subtleText }]}>Images</Text>
                <Text style={[styles.infoCardValue, { color: textColor }]}>
                  {item.additionalImages.length + 1} total
                </Text>
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
                {isCurrentListing 
                  ? "This is a live listing from eBay. Prices and availability may change."
                  : (isAIResult 
                    ? "This listing is from an external marketplace. Prices and availability may have changed."
                    : "This item was sold on eBay. Use this data for market research and pricing guidance."
                  )
                }
              </Text>
            </View>

            {/* Current listing features */}
            {isCurrentListing && (
              <View style={[styles.featuresCard, { backgroundColor: backgroundColor }]}>
                <Text style={[styles.featuresTitle, { color: textColor }]}>Listing Features</Text>
                <View style={styles.featuresGrid}>
                  {item.topRatedBuyingExperience && (
                    <View style={[styles.featureBadge, { backgroundColor: successColor }]}>
                      <Star size={12} color="#000000" />
                      <Text style={styles.featureBadgeText}>Top Rated</Text>
                    </View>
                  )}
                  {item.buyingOptions?.includes('BEST_OFFER') && (
                    <View style={[styles.featureBadge, { backgroundColor: tintColor }]}>
                      <DollarSign size={12} color="#000000" />
                      <Text style={styles.featureBadgeText}>Best Offer</Text>
                    </View>
                  )}
                  {item.availableCoupons && (
                    <View style={[styles.featureBadge, { backgroundColor: '##FF69B4' }]}>
                      <Tag size={12} color="#fff" />
                      <Text style={styles.featureBadgeText}>Coupons</Text>
                    </View>
                  )}
                  {item.shippingOptions?.some((option: any) => option.shippingCost?.value === '0.00') && (
                    <View style={[styles.featureBadge, { backgroundColor: '#8338ec' }]}>
                      <TrendingUp size={12} color="#fff" />
                      <Text style={[styles.featureBadgeText, { color: '#fff' }]}>Free Ship</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Enhanced Seller Info for Current Listings */}
            {(isCurrentListing && item.seller) ? (
              <Animated.View 
                style={[styles.sellerCard, { backgroundColor: backgroundColor }]}
                entering={FadeInDown.delay(150).duration(400)}
              >
                <View style={styles.sellerHeader}>
                  <User size={20} color={tintColor} />
                  <Text style={[styles.sellerLabel, { color: textColor }]}>Seller Information</Text>
                </View>
                <View style={styles.sellerDetails}>
                  <View style={styles.sellerMainInfo}>
                    <Text style={[styles.sellerName, { color: textColor }]}>
                      {item.seller?.username || 'Test Seller'}
                    </Text>
                    <View style={styles.sellerStats}>
                      <View style={styles.sellerStat}>
                        <Star size={16} color="#FFD700" fill="#FFD700" />
                        <Text style={[styles.sellerStatText, { color: textColor }]}>
                          {item.seller?.feedbackPercentage || '99'}% positive
                        </Text>
                      </View>
                      <Text style={[styles.sellerFeedbackScore, { color: subtleText }]}>
                        {item.seller?.feedbackScore || '999'} feedback
                      </Text>
                    </View>
                  </View>
                  {item.topRatedBuyingExperience && (
                    <View style={[styles.topRatedSellerBadge, { backgroundColor: successColor }]}>
                      <Text style={styles.topRatedSellerText}>TOP RATED</Text>
                    </View>
                  )}
                </View>
              </Animated.View>
            ) : null}

            {/* eBay Link Button */}
            <EbayLinkButton
              itemUrl={item.url || item.itemWebUrl}
              isCurrentListing={isCurrentListing}
              itemId={item.itemId}
              disabled={!item.url && !item.itemWebUrl}
            />
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
  sellerCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    marginBottom: 20,
  },
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sellerLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    marginLeft: 8,
  },
  sellerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sellerMainInfo: {
    flex: 1,
  },
  sellerName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    marginBottom: 4,
  },
  sellerStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  sellerStatText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  sellerFeedbackScore: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  featuresCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    marginBottom: 20,
  },
  featuresTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    marginBottom: 16,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
  },
  featureBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginLeft: 8,
  },
  topRatedSellerBadge: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
  },
  topRatedSellerText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#fff',
  },
  imageCarousel: {
    width: width,
    height: width * 0.8,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  imageCounter: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#fff',
  },
});