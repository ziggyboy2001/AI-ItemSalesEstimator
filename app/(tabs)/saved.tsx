import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, SafeAreaView, FlatList, TouchableOpacity, Alert, ActivityIndicator, Image, ScrollView, Dimensions, RefreshControl, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, Layout, FadeOut } from 'react-native-reanimated';
import { Trash2, PlusCircle, BarChart3, History, Package, Target, TrendingUp, DollarSign } from 'lucide-react-native';
import { useThemeColor } from '@/constants/useThemeColor';
import { supabase } from '@/services/supabaseClient';
import { useIsFocused } from '@react-navigation/native';
import { PieChart as GiftedPieChart } from 'react-native-gifted-charts';
import { HaulItemSkeleton, MetricCardSkeleton, SkeletonList } from '@/components/SkeletonLoader';

type TabType = 'current' | 'history' | 'stats';

export default function HaulScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');
  const tintColor = useThemeColor('tint');
  const errorColor = useThemeColor('error');
  const cardColor = useThemeColor('background');
  const successColor = useThemeColor('success');
  const btnBorderColor = useThemeColor('tint');
  const subtleText = useThemeColor('tabIconDefault');
  const borderColor = useThemeColor('tabIconDefault');
  const [loading, setLoading] = useState(true);
  const [haul, setHaul] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('current');
  const [haulHistory, setHaulHistory] = useState<any[]>([]);
  const [lifetimeStats, setLifetimeStats] = useState<any>(null);

  const isFocused = typeof useIsFocused === 'function' ? useIsFocused() : true;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id ?? null));
  }, []);

  const fetchHaulHistory = async () => {
    if (!userId) return;
    const { data: hauls, error } = await supabase
      .from('hauls')
      .select(`
        *,
        haul_items (
          id,
          purchase_price,
          sale_price
        )
      `)
      .eq('user_id', userId)
      .eq('finished', true)
      .order('finished_at', { ascending: false });
    if (!error && hauls) {
      setHaulHistory(hauls);
    }
  };

  const calculateLifetimeStats = async () => {
    if (!userId) return;
    
    // Get all finished hauls with their items
    const { data: hauls, error } = await supabase
      .from('hauls')
      .select(`
        *,
        haul_items (
          purchase_price,
          sale_price
        )
      `)
      .eq('user_id', userId)
      .eq('finished', true);
      
    if (!error && hauls) {
      const totalHauls = hauls.length;
      const totalItems = hauls.reduce((sum, haul) => sum + (haul.haul_items?.length || 0), 0);
      const totalSpent = hauls.reduce((sum, haul) => 
        sum + (haul.haul_items?.reduce((itemSum: number, item: any) => 
          itemSum + (Number(item.purchase_price) || 0), 0) || 0), 0);
      const totalRevenue = hauls.reduce((sum, haul) => 
        sum + (haul.haul_items?.reduce((itemSum: number, item: any) => 
          itemSum + (Number(item.sale_price) || 0), 0) || 0), 0);
      const totalProfit = totalRevenue - totalSpent;
      const profitMargin = totalSpent > 0 ? ((totalProfit / totalSpent) * 100) : 0;
      const avgHaulProfit = totalHauls > 0 ? totalProfit / totalHauls : 0;
      
      // Find best and worst hauls
      const haulProfits = hauls.map(haul => {
        const spent = haul.haul_items?.reduce((sum: number, item: any) => sum + (Number(item.purchase_price) || 0), 0) || 0;
        const revenue = haul.haul_items?.reduce((sum: number, item: any) => sum + (Number(item.sale_price) || 0), 0) || 0;
        return { ...haul, profit: revenue - spent };
      });
      
      const bestHaul = haulProfits.reduce((best, current) => current.profit > best.profit ? current : best, haulProfits[0] || null);
      const worstHaul = haulProfits.reduce((worst, current) => current.profit < worst.profit ? current : worst, haulProfits[0] || null);
      
      setLifetimeStats({
        totalHauls,
        totalItems,
        totalSpent,
        totalRevenue,
        totalProfit,
        profitMargin,
        avgHaulProfit,
        bestHaul,
        worstHaul
      });
    }
  };

  const fetchHaul = async () => {
    if (!userId) return;
    if (!refreshing) setLoading(true);
    // Get open haul
    const { data: hauls, error: haulError } = await supabase
      .from('hauls')
      .select('*')
      .eq('user_id', userId)
      .eq('finished', false)
      .order('created_at', { ascending: false })
      .limit(1);
    if (haulError) {
      if (!refreshing) setLoading(false);
      return;
    }
    const openHaul = hauls && hauls[0];
    setHaul(openHaul);
    if (openHaul) {
      // Get items for this haul
      const { data: haulItems, error: itemsError } = await supabase
        .from('haul_items')
        .select('*')
        .eq('haul_id', openHaul.id)
        .order('added_at', { ascending: false });
      setItems(haulItems || []);
    } else {
      setItems([]);
    }
    if (!refreshing) setLoading(false);
  };

  const fetchAllData = async () => {
    await Promise.all([
      fetchHaul(),
      fetchHaulHistory(),
      calculateLifetimeStats()
    ]);
  };

  useEffect(() => {
    if (userId && isFocused) fetchAllData();
  }, [userId, isFocused]);

  // Calculate summary
  const totalSpent = items.reduce((sum, i) => sum + (Number(i.purchase_price) || 0), 0);
  const totalExpected = items.reduce((sum, i) => sum + (Number(i.sale_price) || 0), 0);
  const totalProfit = totalExpected - totalSpent;
  const avgMargin = items.length > 0 ? items.reduce((sum, i) => sum + ((Number(i.sale_price) || 0) - (Number(i.purchase_price) || 0)), 0) / items.length : 0;

  // Prepare data for react-native-gifted-charts PieChart
  const giftedPieChartData = [
    {
      value: Number(totalSpent.toFixed(2)),
      color: errorColor,
      text: `Spent\n$${totalSpent.toFixed(2)}`,
    },
    {
      value: Number(totalExpected.toFixed(2)),
      color: successColor,
      text: `Revenue\n$${totalExpected.toFixed(2)}`,
    },
  ];

  const handleFinishHaul = async () => {
    if (!haul) return;
    Alert.alert('Finish Haul', 'Are you sure you want to lock this haul? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', style: 'destructive', onPress: async () => {
        await supabase.from('hauls').update({ finished: true, finished_at: new Date().toISOString() }).eq('id', haul.id);
        setHaul(null);
        setItems([]);
        await fetchAllData();
      } }
    ]);
  };

  const handleStartNewHaul = async () => {
    if (!userId) return;
    const { data, error } = await supabase.from('hauls').insert({ user_id: userId, name: `Haul ${new Date().toLocaleDateString()}` }).select();
    if (data && data[0]) {
      setHaul(data[0]);
      setItems([]);
      setActiveTab('current');
    }
  };

  // Delete item from haul
  const handleDeleteItem = async (itemId: string) => {
    Alert.alert('Delete Item', 'Are you sure you want to remove this item from your haul?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('haul_items').delete().eq('id', itemId);
        setItems(items => items.filter(i => i.id !== itemId));
      } }
    ]);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  // Tab component
  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'current' && { backgroundColor: tintColor + '20' }]}
        onPress={() => setActiveTab('current')}
      >
        <Package size={20} color={activeTab === 'current' ? textColor : subtleText} />
        <Text style={[styles.tabText, { 
          color: activeTab === 'current' ? textColor : subtleText,
          fontWeight: activeTab === 'current' ? 'bold' : 'normal'
        }]}>Current</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'history' && { backgroundColor: tintColor + '20' }]}
        onPress={() => setActiveTab('history')}
      >
        <History size={20} color={activeTab === 'history' ? textColor : subtleText} />
        <Text style={[styles.tabText, { 
          color: activeTab === 'history' ? textColor : subtleText,
          fontWeight: activeTab === 'history' ? 'bold' : 'normal'
        }]}>History</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'stats' && { backgroundColor: tintColor + '20' }]}
        onPress={() => setActiveTab('stats')}
      >
        <BarChart3 size={20} color={activeTab === 'stats' ? textColor : subtleText} />
        <Text style={[styles.tabText, { 
          color: activeTab === 'stats' ? textColor : subtleText,
          fontWeight: activeTab === 'stats' ? 'bold' : 'normal'
        }]}>Stats</Text>
      </TouchableOpacity>
    </View>
  );

  // Statistics view
  const renderStatsView = () => {
    if (!lifetimeStats) {
      return (
        <View style={{ padding: 16 }}>
          <Text style={{ color: textColor, fontSize: 18, textAlign: 'center' }}>No completed hauls yet</Text>
        </View>
      );
    }
    
    const { totalHauls, totalItems, totalSpent, totalRevenue, totalProfit, profitMargin, avgHaulProfit, bestHaul, worstHaul } = lifetimeStats;
    
    return (
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[tintColor]}
            tintColor={tintColor}
          />
        }
      >
        <Text style={{ color: textColor, fontSize: 22, fontWeight: 'bold', marginBottom: 16 }}>Lifetime Statistics</Text>
        
        {/* Key Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: 'rgba(128, 128, 128, 0.1)' }]}>
            <View style={[styles.metricIcon, { backgroundColor: tintColor + '20' }]}>
              <Package size={20} color={tintColor} />
            </View>
            <Text style={[styles.metricValue, { color: textColor }]}>{totalHauls}</Text>
            <Text style={[styles.metricTitle, { color: textColor }]}>Total Hauls</Text>
          </View>
          
          <View style={[styles.metricCard, { backgroundColor: 'rgba(128, 128, 128, 0.1)' }]}>
            <View style={[styles.metricIcon, { backgroundColor: tintColor + '20' }]}>
              <Target size={20} color={tintColor} />
            </View>
            <Text style={[styles.metricValue, { color: textColor }]}>{totalItems}</Text>
            <Text style={[styles.metricTitle, { color: textColor }]}>Total Items</Text>
          </View>
          
          <View style={[styles.metricCard, { backgroundColor: 'rgba(128, 128, 128, 0.1)' }]}>
            <View style={[styles.metricIcon, { backgroundColor: errorColor + '20' }]}>
              <DollarSign size={20} color={errorColor} />
            </View>
            <Text style={[styles.metricValue, { color: textColor }]}>${totalSpent.toFixed(2)}</Text>
            <Text style={[styles.metricTitle, { color: textColor }]}>Total Spent</Text>
          </View>
          
          <View style={[styles.metricCard, { backgroundColor: 'rgba(128, 128, 128, 0.1)' }]}>
            <View style={[styles.metricIcon, { backgroundColor: successColor + '20' }]}>
              <TrendingUp size={20} color={successColor} />
            </View>
            <Text style={[styles.metricValue, { color: totalProfit >= 0 ? successColor : errorColor }]}>
              ${totalProfit.toFixed(2)}
            </Text>
            <Text style={[styles.metricTitle, { color: textColor }]}>Total Profit</Text>
          </View>
        </View>
        
        {/* Profit Overview */}
        <View style={[styles.overviewCard, { backgroundColor: 'rgba(128, 128, 128, 0.1)' }]}>
          <Text style={{ color: textColor, fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Profit Overview</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: textColor }}>Profit Margin:</Text>
            <Text style={{ color: profitMargin >= 0 ? successColor : errorColor, fontWeight: 'bold' }}>
              {profitMargin.toFixed(1)}%
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: textColor }}>Avg Haul Profit:</Text>
            <Text style={{ color: avgHaulProfit >= 0 ? successColor : errorColor, fontWeight: 'bold' }}>
              ${avgHaulProfit.toFixed(2)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: textColor }}>Revenue/Spent Ratio:</Text>
            <Text style={{ color: textColor, fontWeight: 'bold' }}>
              {totalSpent > 0 ? (totalRevenue / totalSpent).toFixed(2) : '0.00'}x
            </Text>
          </View>
        </View>
        
        {/* Best/Worst Performance */}
        {bestHaul && worstHaul && (
          <View>
            <View style={[styles.performanceCard, { backgroundColor: 'rgba(128, 128, 128, 0.1)', borderColor: successColor + '30' }]}>
              <Text style={{ color: successColor, fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>Best Performing Haul</Text>
              <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 16 }}>{bestHaul.name}</Text>
              <Text style={{ color: successColor, fontWeight: 'bold', fontSize: 18 }}>+${bestHaul.profit.toFixed(2)}</Text>
              <Text style={{ color: subtleText, fontSize: 12 }}>
                {new Date(bestHaul.finished_at).toLocaleDateString()}
              </Text>
            </View>
            
            {bestHaul.id !== worstHaul.id && (
              <View style={[styles.performanceCard, { backgroundColor: 'rgba(128, 128, 128, 0.1)', borderColor: errorColor + '30' }]}>
                <Text style={{ color: errorColor, fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>Needs Improvement</Text>
                <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 16 }}>{worstHaul.name}</Text>
                <Text style={{ color: worstHaul.profit >= 0 ? successColor : errorColor, fontWeight: 'bold', fontSize: 18 }}>
                  {worstHaul.profit >= 0 ? '+' : ''}${worstHaul.profit.toFixed(2)}
                </Text>
                <Text style={{ color: subtleText, fontSize: 12 }}>
                  {new Date(worstHaul.finished_at).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    );
  };

  // History view
  const renderHistoryView = () => (
    <ScrollView 
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[tintColor]}
          tintColor={tintColor}
        />
      }
    >
      <Text style={{ color: textColor, fontSize: 22, fontWeight: 'bold', marginBottom: 16 }}>Haul History</Text>
      {haulHistory.length === 0 ? (
        <Text style={{ color: subtleText, textAlign: 'center', marginTop: 40 }}>No finished hauls yet.</Text>
      ) : (
        haulHistory.map(haul => {
          const totalSpent = haul.haul_items?.reduce((sum: number, item: any) => sum + (Number(item.purchase_price) || 0), 0) || 0;
          const totalRevenue = haul.haul_items?.reduce((sum: number, item: any) => sum + (Number(item.sale_price) || 0), 0) || 0;
          const totalProfit = totalRevenue - totalSpent;
          const itemCount = haul.haul_items?.length || 0;
          
          return (
            <TouchableOpacity 
              key={haul.id} 
              style={[styles.historyCard, { backgroundColor: 'rgba(128, 128, 128, 0.1)', borderColor: borderColor + '20' }]}
              onPress={() => router.push(`/haul/${haul.id}`)}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 16 }}>{haul.name}</Text>
                  <Text style={{ color: subtleText, fontSize: 13, marginTop: 2 }}>
                    Finished: {haul.finished_at ? new Date(haul.finished_at).toLocaleDateString() : ''}
                  </Text>
                  <Text style={{ color: subtleText, fontSize: 13 }}>
                    {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ 
                    color: totalProfit >= 0 ? successColor : errorColor, 
                    fontWeight: 'bold', 
                    fontSize: 16 
                  }}>
                    {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
                  </Text>
                  <Text style={{ color: subtleText, fontSize: 12 }}>
                    ${totalSpent.toFixed(2)} → ${totalRevenue.toFixed(2)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );

  // List header for summary and graphs
  const renderHeader = () => (
    <View style={{ paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: textColor, fontSize: 22, fontWeight: 'bold', marginBottom: 8 }}>{haul.name || 'Current Haul'}</Text>
          <Text style={{ color: textColor, fontSize: 16, marginBottom: 2, fontWeight: 'bold' }}>Overview:</Text>
          <Text style={{ color: textColor, fontSize: 16, marginBottom: 2 }}>Total Items: {items.length}</Text>
          <Text style={{ color: textColor, fontSize: 16, marginBottom: 2 }}>Total Spent: ${totalSpent.toFixed(2)}</Text>
          <Text style={{ color: textColor, fontSize: 16, marginBottom: 2 }}>Expected Sales: ${totalExpected.toFixed(2)}</Text>
          <Text style={{ color: textColor, fontSize: 16, marginBottom: 2 }}>Expected Profit: <Text style={{ color: successColor, fontWeight: 'bold', }}>${totalProfit.toFixed(2)}</Text></Text>
          <Text style={{ color: textColor, fontSize: 16, marginBottom: 8 }}>Average Margin: ${avgMargin.toFixed(2)}</Text>
        </View>
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <View>
            {(totalSpent > 0 || totalExpected > 0) ? (
              <GiftedPieChart
                data={giftedPieChartData}
                donut
                textColor={textColor}
                textSize={14}
                radius={80}
                innerRadius={50}
                innerCircleColor={backgroundColor}
                centerLabelComponent={() => (
                  totalProfit > 0 ? (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 16 }}>Profit</Text>
                      <Text style={{ color: textColor, fontSize: 14 }}>${totalProfit.toFixed(2)}</Text>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 16 }}>Profit</Text>
                      <Text style={{ color: errorColor, fontSize: 14 }}>LOSS</Text>
                    </View>
                  )
                )}
                strokeColor={backgroundColor}
                strokeWidth={1}
                showValuesAsLabels={false}
                showGradient={false}
              />
            ) : (
              <Text style={{ color: textColor, fontSize: 12, textAlign: 'center', marginTop: 8 }}>No data to display.</Text>
            )}
          </View>
        </View>
      </View>

      <View style={{ marginTop: 16, marginBottom: 8 }}>
        <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>Items in Haul</Text>
      </View>
    </View>
  );
  
  // Current haul view
  const renderCurrentView = () => {
    if (!haul) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <Package size={48} color={subtleText} style={{ marginBottom: 16 }} />
          <Text style={{ color: textColor, fontSize: 20, marginBottom: 16, textAlign: 'center' }}>No Active Haul</Text>
          <Text style={{ color: subtleText, fontSize: 16, marginBottom: 24, textAlign: 'center' }}>
            Search an item to start a new haul to track your items and profits
          </Text>
          {/* <TouchableOpacity 
            style={{ backgroundColor: tintColor, borderRadius: 8, padding: 16 }} 
            onPress={handleStartNewHaul}
          >
            <Text style={{ color: textColor, fontWeight: 'bold' }}>Start New Haul</Text>
          </TouchableOpacity> */}
        </View>
      );
    }
    
    return (
      <>
        {items.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <Text style={{ color: textColor, fontSize: 18, marginTop: 32, textAlign: 'center' }}>No items in this haul yet.</Text>
            <Text style={{ color: subtleText, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
              Add items from search results to track them here
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListHeaderComponent={renderHeader}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[tintColor]}
                tintColor={tintColor}
              />
            }
            renderItem={({ item }) => {
              const margin = (Number(item.sale_price) || 0) - (Number(item.purchase_price) || 0);
              return (
                <Animated.View entering={FadeInDown.duration(400)} layout={Layout.springify()} style={[styles.itemCard, { backgroundColor: 'rgba(128, 128, 128, 0.1)', shadowColor: cardColor, marginBottom: 16 }]}> 
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={styles.itemImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.itemImage, { justifyContent: 'center', alignItems: 'flex-start', backgroundColor: 'transparent' }]}>
                        <PlusCircle size={28} color={tintColor} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 16 }}>{item.title.length > 20 ? `${item.title.slice(0, 20)}...` : item.title}</Text>
                      <Text style={{ color: textColor, fontSize: 14 }}>Expected Sale: ${Number(item.sale_price).toFixed(2)}</Text>
                      <Text style={{ color: textColor, fontSize: 14 }}>Purchase Price: ${Number(item.purchase_price).toFixed(2)}</Text>
                      <Text style={{ color: margin >= 0 ? tintColor : errorColor, fontWeight: 'bold', fontSize: 14 }}>Margin: ${margin.toFixed(2)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={{ marginLeft: 8, padding: 8 }}>
                      <Trash2 size={22} color={errorColor} />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              );
            }}
          />
        )}
        
        {/* Fixed Finish Haul Button */}
        {haul && (
          <View style={[styles.fixedButtonContainer, { backgroundColor }]}>
            <TouchableOpacity 
              style={[styles.finishButton, { backgroundColor: backgroundColor, borderColor: btnBorderColor }]} 
              onPress={handleFinishHaul}
            >
              <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 16 }}>Finish Haul</Text>
            </TouchableOpacity>
          </View>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor }]}>
        <View style={{ padding: 16 }}>
          {/* Header skeleton */}
          <View style={{ marginBottom: 20 }}>
            <View style={{ width: 150, height: 22, backgroundColor: tintColor + '20', borderRadius: 4, marginBottom: 16 }} />
            
            {/* Metrics grid skeleton */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
            </View>
          </View>
          
          {/* Items list skeleton */}
          <SkeletonList count={4} ItemSkeleton={HaulItemSkeleton} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor }]}> 
      {renderTabs()}
      <View style={styles.contentContainer}>
        {activeTab === 'current' && renderCurrentView()}
        {activeTab === 'history' && renderHistoryView()}
        {activeTab === 'stats' && renderStatsView()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  itemCard: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, marginHorizontal: 8, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  itemImage: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#eee' },
  tabContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  tab: { 
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 8
  },
  tabText: { 
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center'
  },
  contentContainer: { 
    flex: 1,
    paddingTop: 16
  },
  metricsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between', 
    marginBottom: 16 
  },
  metricCard: { 
    width: '47%',
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  metricIcon: { 
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  metricValue: { 
    fontSize: 18, 
    fontWeight: 'bold',
    marginBottom: 4
  },
  metricTitle: { 
    fontSize: 14,
    textAlign: 'center'
  },
  overviewCard: { 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  performanceCard: { 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center'
  },
  historyCard: { 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  fixedButtonContainer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: 16
  },
  finishButton: { 
    padding: 16, 
    borderRadius: 8, 
    alignItems: 'center',
    borderWidth: 1
  },
});