import { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { DollarSign, Users, Star, Package, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useThemeColor } from '@/constants/useThemeColor';

//test comment

interface SearchStatsCardProps {
  stats: {
    averagePrice: number;
    priceRange: {
      min: number;
      max: number;
    };
    totalItems: number;
    topRatedSellers: number;
    averageSellerRating: number;
    conditionBreakdown: Record<string, number>;
    itemsSold: number;
  };
}

export default function SearchStatsCard({ stats }: SearchStatsCardProps) {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  // THEME COLORS
  const backgroundColor = useThemeColor('background');
  const cardText = useThemeColor('text');
  const cardSubtle = useThemeColor('tabIconDefault');
  const cardBorder = useThemeColor('tabIconDefault');
  const cardTint = useThemeColor('tint');
  const cardSuccess = useThemeColor('success');
  const cardError = useThemeColor('error');

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <Animated.View 
      style={[styles.container, { backgroundColor, shadowColor: cardSubtle }]}
      entering={FadeInDown.delay(300).duration(400)}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: cardText }]}>Search Statistics</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <DollarSign size={20} color={cardTint} />
          <Text style={[styles.statValue, { color: cardText }]}>{formatPrice(stats.averagePrice)}</Text>
          <Text style={[styles.statLabel, { color: cardSubtle }]}>Avg. Price</Text>
        </View>

        <View style={styles.statItem}>
          <Users size={20} color={cardTint} />
          <Text style={[styles.statValue, { color: cardText }]}>{stats.itemsSold}</Text>
          <Text style={[styles.statLabel, { color: cardSubtle }]}>Items Sold</Text>
        </View>

        <View style={styles.statItem}>
          <Star size={20} color={cardTint} />
          <Text style={[styles.statValue, { color: cardText }]}>{formatPercentage(stats.averageSellerRating)}</Text>
          <Text style={[styles.statLabel, { color: cardSubtle }]}>Avg. Rating</Text>
        </View>

        <View style={styles.statItem}>
          <Package size={20} color={cardTint} />
          <Text style={[styles.statValue, { color: cardText }]}>{stats.totalItems}</Text>
          <Text style={[styles.statLabel, { color: cardSubtle }]}>Total Items</Text>
        </View>
      </View>

      <View style={styles.priceRange}>
        <TrendingUp size={16} color={cardSubtle} />
        <Text style={[styles.priceRangeText, { color: cardSubtle }]}>Price Range: {formatPrice(stats.priceRange.min)} - {formatPrice(stats.priceRange.max)}</Text>
      </View>

      <TouchableOpacity 
        style={[styles.conditionHeader, { borderTopColor: cardBorder }]}
        onPress={() => setIsBreakdownOpen(!isBreakdownOpen)}
      >
        <Text style={[styles.conditionTitle, { color: cardText }]}>Condition Breakdown</Text>
        {isBreakdownOpen ? (
          <ChevronUp size={20} color={cardSubtle} />
        ) : (
          <ChevronDown size={20} color={cardSubtle} />
        )}
      </TouchableOpacity>

      {isBreakdownOpen && (
        <Animated.View 
          style={styles.conditionBreakdown}
          entering={FadeInDown.duration(200)}
          layout={Layout.springify()}
        >
          {Object.entries(stats.conditionBreakdown).map(([condition, count]) => (
            <View key={condition} style={styles.conditionItem}>
              <Text style={[styles.conditionLabel, { color: cardSubtle }]}>{condition}:</Text>
              <Text style={[styles.conditionCount, { color: cardText }]}>{count}</Text>
            </View>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    marginLeft: 8,
    marginRight: 4,
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  priceRange: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  priceRangeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginLeft: 8,
  },
  conditionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  conditionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  conditionBreakdown: {
    marginTop: 8,
  },
  conditionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  conditionLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  conditionCount: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
}); 