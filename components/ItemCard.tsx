import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { formatDistanceToNow } from '@/utils/dateUtils';
import { ShoppingBag, ExternalLink } from 'lucide-react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useThemeColor } from '@/constants/useThemeColor';

interface ItemCardProps {
  item: {
    title: string;
    sale_price: number;
    image_url?: string;
    condition?: string;
    date_sold: string;
    buying_format?: string;
    shipping_price?: string | number;
    link?: string;
    // Current listings specific data
    seller?: {
      username: string;
      feedbackPercentage: string;
      feedbackScore: number;
    };
    additionalImages?: Array<{ imageUrl: string }>;
    topRatedBuyingExperience?: boolean;
    buyingOptions?: string[];
    itemOriginDate?: string; // For current listings date
    itemLocation?: {
      country: string;
      postalCode?: string;
    };
    availableCoupons?: boolean;
  };
  onPress: () => void;
  isOutlier?: 'high' | 'low' | null;
  isMostRecent?: boolean;
  purchasePrice?: number;
  isAIResult?: boolean;
  sourceWebsite?: string;
  isCurrentListing?: boolean; // New flag to identify current listings
}

export default function ItemCard({ 
  item, 
  onPress, 
  isOutlier = null, 
  isMostRecent = false, 
  purchasePrice, 
  isAIResult = false, 
  sourceWebsite,
  isCurrentListing = false 
}: ItemCardProps) {
  if (!item) return null;

  // Color logic for outliers
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const priceColor = useThemeColor('tint');
  const conditionColor = useThemeColor('tabIconDefault');
  const timeColor = useThemeColor('tabIconDefault');
  const badgeColor = '#FFD700'; // gold for 'Most Recent'
  const successColor = '#2ecc40';
  const errorColor = '#e74c3c';
  
  const profit = purchasePrice !== undefined ? (item.sale_price - purchasePrice) : undefined;
  const profitColor = profit !== undefined ? (profit > 0 ? successColor : errorColor) : priceColor;

  // Current listings specific logic
  const hasMultipleImages = isCurrentListing && item.additionalImages && item.additionalImages.length > 0;
  const imageCount = hasMultipleImages ? (item.additionalImages?.length ?? 0) + 1 : 1; // +1 for main image
  const sellerRating = isCurrentListing && item.seller ? parseFloat(item.seller.feedbackPercentage || '0') : null;
  const isTopRated = isCurrentListing && item.topRatedBuyingExperience;
  const hasBestOffer = isCurrentListing && item.buyingOptions?.includes('BEST_OFFER');
  const hasFreeCoupons = isCurrentListing && item.availableCoupons;
  const listingLocation = isCurrentListing && item.itemLocation ? `${item.itemLocation.country}${item.itemLocation.postalCode ? `, ${item.itemLocation.postalCode.replace(/\*/g, '')}` : ''}` : null;

  // Format listing date for current listings
  const formatListingDate = (dateStr: string) => {
    if (!dateStr) return 'Unknown';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {item.image_url && !isAIResult ? (
          <Image 
            source={{ uri: item.image_url }} 
            style={[styles.image, { backgroundColor: backgroundColor }]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.noImageContainer, { backgroundColor: backgroundColor }]}>
            <ShoppingBag size={20} color="#ccc" />
            {isAIResult && sourceWebsite && typeof sourceWebsite === 'string' && sourceWebsite.trim() !== '' && (
              <Text style={styles.sourceLabel}>{sourceWebsite}</Text>
            )}
          </View>
        )}
        {/* Multiple images indicator for current listings only */}
        {hasMultipleImages && (
          <View style={[styles.imageCountBadge, { backgroundColor: 'rgba(0,0,0,0.7)' }]}> 
            <Text style={styles.imageCountText}>+{item.additionalImages?.length || 0}</Text>
          </View>
        )}
      </View>

      <View style={styles.contentContainer}>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
          {item.title}
        </Text>
        
        {/* Show different data based on item type */}
        <View style={styles.detailsRow}>
          <View style={styles.detailBlock}>
            <Text style={[styles.detailNumber, { color: priceColor }]}>
              ${typeof item.sale_price === 'number' && !isNaN(item.sale_price) ? item.sale_price.toFixed(2) : 'N/A'}
            </Text>
            <Text style={styles.detailLabel}>{isCurrentListing ? 'Current' : 'Sold'}</Text>
          </View>
          
          {/* Shipping - show for both types */}
          {item.shipping_price !== undefined && (
            <View style={styles.detailBlock}>
              <Text style={[styles.detailNumber, { color: priceColor }]}>{
                typeof item.shipping_price === 'number'
                  ? item.shipping_price === 0 ? 'Free' : `$${item.shipping_price.toFixed(2)}`
                  : (typeof item.shipping_price === 'string' && item.shipping_price.toLowerCase().includes('free'))
                    ? 'Free'
                    : item.shipping_price
              }</Text>
              <Text style={styles.detailLabel}>Ship</Text>
            </View>
          )}
          
          {/* CURRENT LISTINGS ONLY - show seller rating and listing date */}
          {isCurrentListing === true && (
            <>
              {item.seller && sellerRating !== null && (
                <View style={styles.detailBlock}>
                  <Text style={[styles.detailNumber, { color: priceColor }]}>{sellerRating.toFixed(1)}%</Text>
                  <Text style={styles.detailLabel}>Rating</Text>
                </View>
              )}
              
              {item.itemOriginDate && (
                <View style={styles.detailBlock}>
                  <Text style={[styles.detailNumber, { color: priceColor }]}>{formatListingDate(item.itemOriginDate)}</Text>
                  <Text style={styles.detailLabel}>Listed</Text>
                </View>
              )}
            </>
          )}
          
          {/* SOLD ITEMS ONLY - show sold date and profit/loss */}
          {isCurrentListing === false && (
            <>
              {item.date_sold && (
                <View style={styles.detailBlock}>
                  <Text style={[styles.detailNumber, { color: priceColor }]}>{(() => {
                    const d = item.date_sold;
                    if (!d) return '--';
                    const parsed = new Date(d);
                    if (parsed.toString() === 'Invalid Date') return d;
                    return parsed.toLocaleDateString();
                  })()}</Text>
                  <Text style={styles.detailLabel}>Sold</Text>
                </View>
              )}
              
              {profit !== undefined && typeof profit === 'number' && !isNaN(profit) && (
                <View style={styles.detailBlock}>
                  <Text style={[styles.detailNumber, { color: profitColor }]}>
                    {profit > 0 ? '+' : ''}${Math.abs(profit).toFixed(2)}
                  </Text>
                  <Text style={styles.detailLabel}>P/L</Text>
                </View>
              )}
            </>
          )}
          
          {/* Condition - show for both */}
          {item.condition && (
            <View style={styles.detailBlock}>
              <Text style={[styles.detailNumber, { color: priceColor }]} numberOfLines={1}>{item.condition}</Text>
              <Text style={styles.detailLabel}>Condition</Text>
            </View>
          )}
        </View>
      </View>

      {/* Badges positioned on top LEFT of entire card */}
      {isMostRecent && (
        <View style={[styles.cardBadge, { backgroundColor: badgeColor }]}> 
          <Text style={styles.cardBadgeText}>Most Recent</Text>
        </View>
      )}
      {isTopRated && (
        <View style={[styles.cardBadge, styles.topRatedCardBadge, { backgroundColor: successColor }]}> 
          <Text style={styles.cardBadgeText}>TOP</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
    height: 100,
  },
  imageContainer: {
    width: 100,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f7f7f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 2,
  },
  badgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#333',
  },
  imageCountBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
  },
  imageCountText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: '#fff',
  },
  topRatedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
  },
  topRatedText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    color: '#fff',
  },
  contentContainer: {
    flex: 1,
    padding: 8,
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
    lineHeight: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 0,
  },
  detailBlock: {
    alignItems: 'flex-start',
    marginRight: 12,
    marginBottom: 2,
    minWidth: 45,
  },
  detailNumber: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#111',
    lineHeight: 15,
  },
  detailLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: '#888',
    marginTop: 1,
  },
  condition: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  linkText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#007aff',
    marginLeft: 4,
    textDecorationLine: 'underline',
    maxWidth: 120,
  },
  sourceLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  conditionBadge: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
  },
  conditionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#666',
  },
  sellerInfo: {
    marginLeft: 8,
  },
  sellerName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#666',
  },
  cardBadge: {
    position: 'absolute',
    bottom: 8,
    right: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 9999,
    shadowColor: '#FFEB3B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  cardBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: '#000000',
  },
  topRatedCardBadge: {
    position: 'absolute',
    bottom: 8,
    right: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
  },
});