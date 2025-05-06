import { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { DollarSign, Users, Star, Package, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import Colors from '@/constants/Colors';

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

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <Animated.View 
      style={styles.container}
      entering={FadeInDown.delay(300).duration(400)}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Search Statistics</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <DollarSign size={20} color={Colors.light.tint} />
          <Text style={styles.statValue}>{formatPrice(stats.averagePrice)}</Text>
          <Text style={styles.statLabel}>Avg. Price</Text>
        </View>

        <View style={styles.statItem}>
          <Users size={20} color={Colors.light.tint} />
          <Text style={styles.statValue}>{stats.itemsSold}</Text>
          <Text style={styles.statLabel}>Items Sold</Text>
        </View>

        <View style={styles.statItem}>
          <Star size={20} color={Colors.light.tint} />
          <Text style={styles.statValue}>{formatPercentage(stats.averageSellerRating)}</Text>
          <Text style={styles.statLabel}>Avg. Rating</Text>
        </View>

        <View style={styles.statItem}>
          <Package size={20} color={Colors.light.tint} />
          <Text style={styles.statValue}>{stats.totalItems}</Text>
          <Text style={styles.statLabel}>Total Items</Text>
        </View>
      </View>

      <View style={styles.priceRange}>
        <TrendingUp size={16} color="#666" />
        <Text style={styles.priceRangeText}>
          Price Range: {formatPrice(stats.priceRange.min)} - {formatPrice(stats.priceRange.max)}
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.conditionHeader}
        onPress={() => setIsBreakdownOpen(!isBreakdownOpen)}
      >
        <Text style={styles.conditionTitle}>Condition Breakdown</Text>
        {isBreakdownOpen ? (
          <ChevronUp size={20} color="#666" />
        ) : (
          <ChevronDown size={20} color="#666" />
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
              <Text style={styles.conditionLabel}>{condition}:</Text>
              <Text style={styles.conditionCount}>{count}</Text>
            </View>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: '#111',
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
    color: '#111',
    marginLeft: 8,
    marginRight: 4,
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#666',
  },
  priceRange: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  priceRangeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  conditionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  conditionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#111',
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
    color: '#666',
  },
  conditionCount: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#111',
  },
}); 