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
  };
  onPress: () => void;
  isOutlier?: 'high' | 'low' | null;
  isMostRecent?: boolean;
  purchasePrice?: number;
}

export default function ItemCard({ item, onPress, isOutlier = null, isMostRecent = false, purchasePrice }: ItemCardProps) {
  if (!item) return null;

  const backgroundColor = isOutlier === 'high'
    ? '#e6f9ed' // light green
    : isOutlier === 'low'
      ? useThemeColor('background') // light red possibly?
      : useThemeColor('background');
  const textColor = useThemeColor('text');
  const priceColor = useThemeColor('tint');
  const conditionColor = useThemeColor('tabIconDefault');
  const timeColor = useThemeColor('tabIconDefault');
  const badgeColor = '#FFD700'; // gold for 'Most Recent'
  const profit = purchasePrice !== undefined ? (item.sale_price - purchasePrice) : undefined;
  const profitColor = profit !== undefined ? (profit > 0 ? '#2ecc40' : '#e74c3c') : priceColor;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {item.image_url ? (
          <Image 
            source={{ uri: item.image_url }} 
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.noImageContainer}>
            <ShoppingBag size={24} color="#ccc" />
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
            <Text style={[styles.detailNumber, { color: priceColor }]}>{item.sale_price?.toFixed(2) ?? 'N/A'}</Text>
            <Text style={styles.detailLabel}>Sold Price</Text>
          </View>
          {item.shipping_price && (
            <View style={styles.detailBlock}>
              <Text style={[styles.detailNumber, { color: priceColor }]}>{
                typeof item.shipping_price === 'number'
                  ? `$${item.shipping_price}`
                  : (typeof item.shipping_price === 'string' && item.shipping_price.toLowerCase().includes('free'))
                    ? 'Free'
                    : item.shipping_price
              }</Text>
              <Text style={styles.detailLabel}>Shipping</Text>
            </View>
          )}
          {item.buying_format && (
            <View style={styles.detailBlock}>
              <Text style={[styles.detailNumber, { color: priceColor }]}>{item.buying_format}</Text>
              <Text style={styles.detailLabel}>Format</Text>
            </View>
          )}
          {item.date_sold && (
            <View style={styles.detailBlock}>
              <Text style={[styles.detailNumber, { color: priceColor }]}>{(() => {
                const d = item.date_sold;
                if (!d) return '--';
                const parsed = new Date(d);
                if (parsed.toString() === 'Invalid Date') return d;
                return parsed.toLocaleDateString();
              })()}</Text>
              <Text style={styles.detailLabel}>Date Sold</Text>
            </View>
          )}
          {profit !== undefined && (
            <View style={styles.detailBlock}>
              <Text style={[styles.detailNumber, { color: profitColor }]}>{profit > 0 ? '+' : ''}{profit.toFixed(2)}</Text>
              <Text style={styles.detailLabel}>Profit/Loss</Text>
            </View>
          )}
        </View>
        {item.condition && (
          <Text style={[styles.condition, { color: conditionColor }]}>{item.condition}</Text>
        )}
        {item.link && (
          <View style={styles.linkRow}>
            <ExternalLink size={16} color={priceColor} />
            <Text style={styles.linkText} numberOfLines={1}>eBay Listing</Text>
          </View>
        )}
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
    backgroundColor: '#f7f7f7',
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
});