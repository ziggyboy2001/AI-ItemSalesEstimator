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
            <ShoppingBag size={24} color="#ccc" />
            {isAIResult && sourceWebsite && typeof sourceWebsite === 'string' && sourceWebsite.trim() !== '' && (
              <Text style={styles.sourceLabel}>{sourceWebsite}</Text>
            )}
          </View>
        )}
        {isMostRecent && (
          <View style={[styles.badge, { backgroundColor: badgeColor }]}> 
            <Text style={styles.badgeText}>Most Recent</Text>
          </View>
        )}
      </View>

      <View style={styles.contentContainer}>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.detailsRow}>
          <View style={styles.detailBlock}>
            <Text style={[styles.detailNumber, { color: priceColor }]}>
              ${typeof item.sale_price === 'number' && !isNaN(item.sale_price) ? item.sale_price.toFixed(2) : 'N/A'}
            </Text>
            <Text style={styles.detailLabel}>{isCurrentListing ? 'Current Price' : (isAIResult ? 'Current Price' : 'Sold Price')}</Text>
          </View>
          
          {/* Shipping info */}
          {item.shipping_price !== undefined && (
            <View style={styles.detailBlock}>
              <Text style={[styles.detailNumber, { color: priceColor }]}>{
                typeof item.shipping_price === 'number'
                  ? item.shipping_price === 0 ? 'Free' : `$${item.shipping_price.toFixed(2)}`
                  : (typeof item.shipping_price === 'string' && item.shipping_price.toLowerCase().includes('free'))
                    ? 'Free'
                    : item.shipping_price
              }</Text>
              <Text style={styles.detailLabel}>Shipping</Text>
            </View>
          )}
          
          {/* Seller info for current listings */}
          {isCurrentListing && item.seller && (
            <View style={styles.detailBlock}>
              <Text style={[styles.detailNumber, { color: priceColor }]}>{item.seller.feedbackScore || 0}</Text>
              <Text style={styles.detailLabel}>Seller Feedback</Text>
            </View>
          )}
          
          {/* Format/Type */}
          {item.buying_format && (
            <View style={styles.detailBlock}>
              <Text style={[styles.detailNumber, { color: priceColor }]}>{item.buying_format}</Text>
              <Text style={styles.detailLabel}>Format</Text>
            </View>
          )}
          
          {/* Date - only for sold items */}
          {!isCurrentListing && item.date_sold && (
            <View style={styles.detailBlock}>
              <Text style={[styles.detailNumber, { color: priceColor }]}>{(() => {
                const d = item.date_sold;
                if (!d) return '--';
                const parsed = new Date(d);
                if (parsed.toString() === 'Invalid Date') return d;
                return parsed.toLocaleDateString();
              })()}</Text>
              <Text style={styles.detailLabel}>{isAIResult ? 'Date Found' : 'Date Sold'}</Text>
            </View>
          )}
          
          {/* Best Offer indicator for current listings */}
          {isCurrentListing && hasBestOffer && (
            <View style={styles.detailBlock}>
              <Text style={[styles.detailNumber, { color: successColor }]}>Yes</Text>
              <Text style={styles.detailLabel}>Best Offer</Text>
            </View>
          )}
          
          {/* Profit/Loss calculation */}
          {profit !== undefined && typeof profit === 'number' && !isNaN(profit) && (
            <View style={styles.detailBlock}>
              <Text style={[styles.detailNumber, { color: profitColor }]}>
                {profit > 0 ? '+' : ''}${Math.abs(profit).toFixed(2)}
              </Text>
              <Text style={styles.detailLabel}>Profit/Loss</Text>
            </View>
          )}
        </View>

        {/* Condition and additional info */}
        <View style={styles.bottomRow}>
          {item.condition && typeof item.condition === 'string' && item.condition.trim() !== '' && (
            <View style={styles.conditionBadge}>
              <Text style={[styles.conditionText, { color: conditionColor }]}>{item.condition}</Text>
            </View>
          )}
          
          {/* Current listings: show seller name */}
          {isCurrentListing && item.seller && (
            <View style={styles.sellerInfo}>
              <Text style={[styles.sellerName, { color: conditionColor }]}>by {item.seller.username}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  imageContainer: {
    width: 100,
    height: 100,
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
  contentContainer: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: '#333',
    marginBottom: 6,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  detailBlock: {
    alignItems: 'flex-start',
    marginRight: 18,
    marginBottom: 4,
    minWidth: 60,
  },
  detailNumber: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#111',
  },
  detailLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#888',
    marginTop: 2,
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
});