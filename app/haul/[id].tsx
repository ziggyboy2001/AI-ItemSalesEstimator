import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Image, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { ArrowLeft, Calendar, DollarSign, TrendingUp, Package, Target } from 'lucide-react-native';
import { useThemeColor } from '@/constants/useThemeColor';
import { supabase } from '@/services/supabaseClient';
import { PieChart as GiftedPieChart } from 'react-native-gifted-charts';
import { HaulItemSkeleton, MetricCardSkeleton, SkeletonList, Skeleton } from '@/components/SkeletonLoader';

interface HaulItem {
  id: string;
  title: string;
  image_url: string;
  purchase_price: number;
  sale_price: number;
  added_at: string;
}

interface Haul {
  id: string;
  name: string;
  finished: boolean;
  finished_at: string;
  created_at: string;
}

export default function HaulDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [haul, setHaul] = useState<Haul | null>(null);
  const [items, setItems] = useState<HaulItem[]>([]);
  
  // Theme colors
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const subtleText = useThemeColor('tabIconDefault');
  const tintColor = useThemeColor('tint');
  const errorColor = useThemeColor('error');
  const successColor = useThemeColor('success');
  const cardColor = useThemeColor('background');

  useEffect(() => {
    fetchHaulDetails();
  }, [id]);

  const fetchHaulDetails = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
      // Fetch haul details
      const { data: haulData, error: haulError } = await supabase
        .from('hauls')
        .select('*')
        .eq('id', id)
        .single();
      
      if (haulError) throw haulError;
      setHaul(haulData);
      
      // Fetch haul items
      const { data: itemsData, error: itemsError } = await supabase
        .from('haul_items')
        .select('*')
        .eq('haul_id', id)
        .order('added_at', { ascending: false });
      
      if (itemsError) throw itemsError;
      setItems(itemsData || []);
      
    } catch (error) {
      console.error('Error fetching haul details:', error);
      Alert.alert('Error', 'Failed to load haul details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor }]}>
        {/* Header Skeleton */}
        <View style={styles.header}>
          <Skeleton width={24} height={24} borderRadius={12} />
          <Skeleton width={150} height={18} />
          <View style={{ width: 24 }} />
        </View>
        
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Summary Section Skeleton */}
          <View style={styles.summarySection}>
            <Skeleton width={100} height={20} style={{ marginBottom: 16 }} />
            <Skeleton width={120} height={120} borderRadius={60} style={{ marginBottom: 16 }} />
            <Skeleton width={180} height={14} />
          </View>
          
          {/* Metrics Grid Skeleton */}
          <View style={styles.metricsGrid}>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </View>
          
          {/* Performance Section Skeleton */}
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Skeleton width={180} height={20} style={{ marginBottom: 16 }} />
            <View style={{ padding: 16, borderRadius: 12, backgroundColor: cardColor, marginBottom: 12 }}>
              <Skeleton width={100} height={12} style={{ marginBottom: 4 }} />
              <Skeleton width="80%" height={16} style={{ marginBottom: 4 }} />
              <Skeleton width={120} height={18} />
            </View>
            <View style={{ padding: 16, borderRadius: 12, backgroundColor: cardColor }}>
              <Skeleton width={120} height={12} style={{ marginBottom: 4 }} />
              <Skeleton width="70%" height={16} style={{ marginBottom: 4 }} />
              <Skeleton width={100} height={18} />
            </View>
          </View>
          
          {/* Items Section Skeleton */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
            <Skeleton width={120} height={20} style={{ marginBottom: 16 }} />
            <SkeletonList count={4} ItemSkeleton={HaulItemSkeleton} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!haul) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={tintColor} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: textColor }]}>Haul not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate metrics
  const totalSpent = items.reduce((sum, item) => sum + (Number(item.purchase_price) || 0), 0);
  const totalRevenue = items.reduce((sum, item) => sum + (Number(item.sale_price) || 0), 0);
  const totalProfit = totalRevenue - totalSpent;
  const profitMargin = totalSpent > 0 ? ((totalProfit / totalSpent) * 100) : 0;
  const avgItemProfit = items.length > 0 ? totalProfit / items.length : 0;
  
  // Best and worst performing items
  const itemsWithProfit = items.map(item => ({
    ...item,
    profit: (Number(item.sale_price) || 0) - (Number(item.purchase_price) || 0),
    margin: Number(item.purchase_price) > 0 ? (((Number(item.sale_price) || 0) - (Number(item.purchase_price) || 0)) / (Number(item.purchase_price) || 0)) * 100 : 0
  }));
  
  const bestItem = itemsWithProfit.reduce((best, current) => 
    current.profit > best.profit ? current : best, itemsWithProfit[0] || null);
  const worstItem = itemsWithProfit.reduce((worst, current) => 
    current.profit < worst.profit ? current : worst, itemsWithProfit[0] || null);

  // Chart data
  const chartData = [
    {
      value: Number(totalSpent.toFixed(2)),
      color: errorColor,
      text: `Spent\n$${totalSpent.toFixed(2)}`,
    },
    {
      value: Number(totalRevenue.toFixed(2)),
      color: successColor,
      text: `Revenue\n$${totalRevenue.toFixed(2)}`,
    },
  ];

  const renderMetricCard = (icon: React.ReactNode, title: string, value: string, subtitle?: string, color?: string) => (
    <Animated.View 
      style={[styles.metricCard, { backgroundColor: cardColor }]}
      entering={FadeInDown.delay(200).duration(400)}
    >
      <View style={[styles.metricIcon, { backgroundColor: color || tintColor + '20' }]}>
        {icon}
      </View>
      <Text style={[styles.metricValue, { color: color || textColor }]}>{value}</Text>
      <Text style={[styles.metricTitle, { color: textColor }]}>{title}</Text>
      {subtitle && <Text style={[styles.metricSubtitle, { color: subtleText }]}>{subtitle}</Text>}
    </Animated.View>
  );

  const renderItemCard = ({ item }: { item: typeof itemsWithProfit[0] }) => (
    <Animated.View 
      style={[styles.itemCard, { backgroundColor: cardColor }]}
      entering={FadeInDown.duration(400)}
      layout={Layout.duration(300)}
    >
      {/* <Image source={{ uri: item.image_url }} style={styles.itemImage} /> */}
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, { color: textColor }]} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.itemPrices}>
          <Text style={[styles.purchasePrice, { color: errorColor }]}>
            Paid: ${item.purchase_price.toFixed(2)}
          </Text>
          <Text style={[styles.salePrice, { color: successColor }]}>
            Sold: ${item.sale_price.toFixed(2)}
          </Text>
        </View>
        <View style={styles.itemMetrics}>
          <Text style={[styles.profit, { color: item.profit >= 0 ? successColor : errorColor }]}>
            Profit: ${item.profit.toFixed(2)}
          </Text>
          <Text style={[styles.margin, { color: subtleText }]}>
            Margin: {item.margin.toFixed(1)}%
          </Text>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor }]}>
      {/* Header */}
      <Animated.View 
        style={styles.header}
        entering={FadeInDown.delay(100).duration(400)}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={tintColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>{haul.name}</Text>
        <View style={{ width: 24 }} />
      </Animated.View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Summary Section */}
        <Animated.View 
          style={styles.summarySection}
          entering={FadeInDown.delay(200).duration(400)}
        >
          <Text style={[styles.sectionTitle, { color: textColor }]}>Summary</Text>
          <View style={styles.chartContainer}>
            {(totalSpent > 0 || totalRevenue > 0) ? (
              <GiftedPieChart
                data={chartData}
                donut
                textColor={textColor}
                textSize={12}
                radius={80}
                innerRadius={50}
                innerCircleColor={backgroundColor}
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 14 }}>Profit</Text>
                    <Text style={{ color: totalProfit >= 0 ? successColor : errorColor, fontSize: 16, fontWeight: 'bold' }}>
                      ${totalProfit.toFixed(2)}
                    </Text>
                  </View>
                )}
                strokeColor={backgroundColor}
                strokeWidth={2}
                showValuesAsLabels={false}
              />
            ) : (
              <Text style={{ color: subtleText, textAlign: 'center' }}>No data available</Text>
            )}
          </View>
          
          <Text style={[styles.dateInfo, { color: subtleText }]}>
            Completed on {new Date(haul.finished_at).toLocaleDateString()}
          </Text>
        </Animated.View>

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          {renderMetricCard(
            <Package size={20} color={tintColor} />,
            'Items',
            items.length.toString(),
            'Total items'
          )}
          {renderMetricCard(
            <DollarSign size={20} color={errorColor} />,
            'Total Spent',
            `$${totalSpent.toFixed(2)}`,
            'Purchase cost'
          )}
          {renderMetricCard(
            <TrendingUp size={20} color={successColor} />,
            'Total Revenue',
            `$${totalRevenue.toFixed(2)}`,
            'Sale revenue'
          )}
          {renderMetricCard(
            <Target size={20} color={profitMargin >= 0 ? successColor : errorColor} />,
            'Profit Margin',
            `${profitMargin.toFixed(1)}%`,
            'ROI percentage',
          )}
        </View>

        {/* Performance Highlights */}
        {bestItem && worstItem && items.length > 1 && (
          <Animated.View 
            style={styles.performanceSection}
            entering={FadeInDown.delay(400).duration(400)}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>Performance Highlights</Text>
            
            <View style={[styles.highlightCard, { backgroundColor: cardColor }]}>
              <Text style={[styles.highlightLabel, { color: successColor }]}>Best Performer</Text>
              <Text style={[styles.highlightTitle, { color: textColor }]} numberOfLines={1}>
                {bestItem.title}
              </Text>
              <Text style={[styles.highlightValue, { color: successColor }]}>
                +${bestItem.profit.toFixed(2)} ({bestItem.margin.toFixed(1)}%)
              </Text>
            </View>

            {bestItem.id !== worstItem.id && (
              <View style={[styles.highlightCard, { backgroundColor: cardColor }]}>
                <Text style={[styles.highlightLabel, { color: errorColor }]}>Needs Improvement</Text>
                <Text style={[styles.highlightTitle, { color: textColor }]} numberOfLines={1}>
                  {worstItem.title}
                </Text>
                <Text style={[styles.highlightValue, { color: worstItem.profit >= 0 ? successColor : errorColor }]}>
                  {worstItem.profit >= 0 ? '+' : ''}${worstItem.profit.toFixed(2)} ({worstItem.margin.toFixed(1)}%)
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* Items List */}
        <Animated.View 
          style={styles.itemsSection}
          entering={FadeInDown.delay(600).duration(400)}
        >
          <Text style={[styles.sectionTitle, { color: textColor }]}>Items ({items.length})</Text>
          {items.length > 0 ? (
            <FlatList
              data={itemsWithProfit}
              keyExtractor={(item) => item.id}
              renderItem={renderItemCard}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <Text style={[styles.emptyText, { color: subtleText }]}>No items in this haul</Text>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  summarySection: {
    padding: 16,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  dateInfo: {
    fontSize: 14,
    textAlign: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  metricCard: {
    flexBasis: '47%',
    margin: '1.5%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  metricSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  performanceSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  highlightCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  highlightLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  highlightTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  highlightValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemsSection: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  itemCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  itemPrices: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  purchasePrice: {
    fontSize: 12,
    fontWeight: '500',
  },
  salePrice: {
    fontSize: 12,
    fontWeight: '500',
  },
  itemMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  profit: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  margin: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
}); 