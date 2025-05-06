import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { formatDistanceToNow } from '@/utils/dateUtils';
import { ShoppingBag, Trash2 } from 'lucide-react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useThemeColor } from '@/constants/useThemeColor';

interface ItemCardProps {
  item: any;
  onPress: () => void;
  isDeleting?: boolean;
  onDelete?: () => void;
}

export default function ItemCard({ item, onPress, isDeleting, onDelete }: ItemCardProps) {
  if (!item) return null;

  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const priceColor = useThemeColor('tint');
  const conditionColor = useThemeColor('tabIconDefault');
  const timeColor = useThemeColor('tabIconDefault');
  const estimateColor = useThemeColor('success');
  const deleteBg = 'rgba(255, 59, 48, 0.1)'; // error color, can be improved for dark mode

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {item.image ? (
          <Image 
            source={{ uri: item.image }} 
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.noImageContainer}>
            <ShoppingBag size={24} color="#ccc" />
          </View>
        )}
      </View>

      <View style={styles.contentContainer}>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
          {item.title}
        </Text>
        
        <View style={styles.detailsContainer}>
          <View>
            <Text style={[styles.price, { color: priceColor }]}>
              {typeof item.price === 'string' ? item.price : `$${item.price?.toFixed(2) || 'N/A'}`}
            </Text>
            
            {item.condition && (
              <Text style={[styles.condition, { color: conditionColor }]}>
                {item.condition}
              </Text>
            )}
          </View>

          {item.timestamp && (
            <Text style={[styles.time, { color: timeColor }]}>
              {formatDistanceToNow(new Date(item.timestamp))}
            </Text>
          )}
        </View>

        {item.estimatedResaleValue && (
          <Animated.View 
            style={styles.estimateContainer}
            entering={FadeInRight.duration(400)}
          >
            <Text style={[styles.estimateLabel, { color: conditionColor }]}>Est. Resale:</Text>
            <Text style={[styles.estimateValue, { color: estimateColor }]}>
              ${item.estimatedResaleValue.toFixed(2)}
            </Text>
          </Animated.View>
        )}
      </View>

      {isDeleting && onDelete && (
        <TouchableOpacity 
          style={[styles.deleteButton, { backgroundColor: deleteBg }]}
          onPress={onDelete}
        >
          <Trash2 size={22} color={useThemeColor('error')} />
        </TouchableOpacity>
      )}
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
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  price: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#111',
  },
  condition: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  time: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#999',
  },
  estimateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  estimateLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#666',
    marginRight: 4,
  },
  estimateValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#34C759',
  },
  deleteButton: {
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
});