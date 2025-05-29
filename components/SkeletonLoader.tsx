import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  interpolate 
} from 'react-native-reanimated';
import { useThemeColor } from '@/constants/useThemeColor';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonProps) {
  const opacity = useSharedValue(0.3);
  const backgroundColor = useThemeColor('tabIconDefault');
  
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.8, { duration: 1000 }),
      -1,
      true
    );
  }, []);
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  
  return (
    <Animated.View 
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: backgroundColor + '40',
        },
        animatedStyle,
        style
      ]} 
    />
  );
}

// Search Result Card Skeleton
export function SearchResultSkeleton() {
  const cardColor = useThemeColor('background');
  const borderColor = useThemeColor('tabIconDefault');
  
  return (
    <View style={[styles.searchCard, { backgroundColor: cardColor, borderColor: borderColor + '20' }]}>
      <Skeleton width={80} height={80} borderRadius={8} style={{ marginRight: 12 }} />
      <View style={styles.searchContent}>
        <Skeleton width="90%" height={16} style={{ marginBottom: 8 }} />
        <Skeleton width="70%" height={14} style={{ marginBottom: 8 }} />
        <View style={styles.searchMeta}>
          <Skeleton width={60} height={12} />
          <Skeleton width={80} height={12} />
        </View>
        <View style={styles.searchFooter}>
          <Skeleton width={100} height={14} />
          <Skeleton width={40} height={12} />
        </View>
      </View>
    </View>
  );
}

// Haul Item Skeleton
export function HaulItemSkeleton() {
  const cardColor = useThemeColor('background');
  const borderColor = useThemeColor('tabIconDefault');
  
  return (
    <View style={[styles.haulItem, { backgroundColor: cardColor, borderColor: borderColor + '20' }]}>
      <Skeleton width={60} height={60} borderRadius={8} style={{ marginRight: 12 }} />
      <View style={styles.haulContent}>
        <Skeleton width="85%" height={14} style={{ marginBottom: 6 }} />
        <View style={styles.haulPrices}>
          <Skeleton width={80} height={12} />
          <Skeleton width={80} height={12} />
        </View>
        <View style={styles.haulMetrics}>
          <Skeleton width={90} height={14} />
          <Skeleton width={60} height={12} />
        </View>
      </View>
    </View>
  );
}

// Search History Item Skeleton
export function SearchHistoryItemSkeleton() {
  const cardColor = useThemeColor('background');
  const borderColor = useThemeColor('tabIconDefault');
  
  return (
    <View style={[styles.historyItem, { backgroundColor: cardColor, borderColor: borderColor + '20' }]}>
      <Skeleton width={60} height={60} borderRadius={8} style={{ marginRight: 12 }} />
      <View style={styles.historyContent}>
        <Skeleton width="80%" height={16} style={{ marginBottom: 6 }} />
        <Skeleton width="60%" height={14} style={{ marginBottom: 4 }} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
  );
}

// Stats Card Skeleton
export function StatsCardSkeleton() {
  const cardColor = useThemeColor('background');
  const borderColor = useThemeColor('tabIconDefault');
  
  return (
    <View style={[styles.statsCard, { backgroundColor: cardColor, borderColor: borderColor + '20' }]}>
      <View style={styles.statsHeader}>
        <Skeleton width={120} height={18} style={{ marginBottom: 8 }} />
        <View style={styles.statsRow}>
          <Skeleton width={80} height={14} />
          <Skeleton width={60} height={14} />
        </View>
        <View style={styles.statsRow}>
          <Skeleton width={100} height={14} />
          <Skeleton width={70} height={14} />
        </View>
      </View>
      <View style={styles.statsChart}>
        <Skeleton width={100} height={100} borderRadius={50} />
      </View>
    </View>
  );
}

// Metric Card Skeleton
export function MetricCardSkeleton() {
  const cardColor = useThemeColor('background');
  
  return (
    <View style={[styles.metricCard, { backgroundColor: cardColor }]}>
      <Skeleton width={40} height={40} borderRadius={20} style={{ marginBottom: 8 }} />
      <Skeleton width={60} height={18} style={{ marginBottom: 4 }} />
      <Skeleton width={80} height={14} style={{ marginBottom: 2 }} />
      <Skeleton width={50} height={12} />
    </View>
  );
}

// Settings Item Skeleton
export function SettingsItemSkeleton() {
  const cardColor = useThemeColor('background');
  const borderColor = useThemeColor('tabIconDefault');
  
  return (
    <View style={[styles.settingsItem, { backgroundColor: cardColor, borderColor: borderColor + '20' }]}>
      <Skeleton width={40} height={40} borderRadius={8} style={{ marginRight: 12 }} />
      <View style={styles.settingsContent}>
        <Skeleton width="70%" height={16} style={{ marginBottom: 4 }} />
        <Skeleton width="90%" height={13} />
      </View>
      <Skeleton width={20} height={20} />
    </View>
  );
}

// List of skeleton items for FlatList
export function SkeletonList({ 
  count = 5, 
  ItemSkeleton = SearchResultSkeleton 
}: { 
  count?: number; 
  ItemSkeleton?: React.ComponentType; 
}) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <ItemSkeleton key={`skeleton-${index}`} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  searchCard: {
    flexDirection: 'row',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  searchMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  searchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  haulItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  haulContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  haulPrices: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  haulMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyItem: {
    flexDirection: 'row',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyContent: {
    flex: 1,
  },
  statsCard: {
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsHeader: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statsChart: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCard: {
    width: '47%',
    margin: '1.5%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  settingsContent: {
    flex: 1,
  },
}); 