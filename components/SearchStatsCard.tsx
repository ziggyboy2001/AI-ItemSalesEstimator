import React from 'react';
import { useState } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { ProgressBarAndroid } from 'react-native';
import { DollarSign, TrendingUp, Clock, Award, ThumbsUp, Users } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColor } from '@/constants/useThemeColor';

//test comment

interface SearchStatsCardProps {
  stats: {
    average_price: number;
    min_price: number;
    max_price: number;
    median_price?: number;
    results: number;
    most_recent_sale?: { price: number; date: string };
    resaleability_score: number; // 1-99
    match_quality: number; // 0-100 (percent)
    unique_sellers?: number;
    market_activity?: string;
  };
  purchasePrice?: number;
}

// Cross-platform ProgressBar
function ProgressBar({ progress, color }: { progress: number; color: string }) {
  if (Platform.OS === 'ios') {
    // Simple fallback for iOS: use a View-based bar
    return (
      <View style={{ height: 8, borderRadius: 4, backgroundColor: '#eee', marginVertical: 2, overflow: 'hidden' }}>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: color, width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
      </View>
    );
  }
  return <ProgressBarAndroid styleAttr="Horizontal" indeterminate={false} progress={progress} color={color} style={{ height: 8, borderRadius: 4, marginVertical: 2 }} />;
}

export default function SearchStatsCard({ stats, purchasePrice }: SearchStatsCardProps) {
  if (!stats) return null;

  const profit = purchasePrice ? stats.average_price - purchasePrice : null;
  const margin = purchasePrice ? (profit! / purchasePrice) : null;
  const profitColor = profit == null ? '#333' : profit > 0 ? '#2ecc40' : '#ff4136';

  // THEME COLORS
  const backgroundColor = useThemeColor('background');
  const cardText = useThemeColor('text');
  const cardSubtle = useThemeColor('tabIconDefault');
  const cardTint = useThemeColor('tint');
  const cardSuccess = useThemeColor('success');
  const cardError = useThemeColor('error');

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;

  return (
    <Animated.View 
      style={[styles.container, { backgroundColor, shadowColor: cardSubtle }]}
      entering={FadeInDown.delay(300).duration(400)}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: cardText }]}>Market Snapshot</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <DollarSign size={20} color={cardTint} />
          <View style={{ marginLeft: 8 }}>
            <Text style={[styles.statValue, { color: cardText }]}>{formatPrice(stats.average_price)}</Text>
            <Text style={[styles.statLabel, { color: cardSubtle }]}>Avg. Price</Text>
          </View>
        </View>
        {/* <View style={styles.statItem}>
          <DollarSign size={20} color={cardTint} />
          <View style={{ marginLeft: 8 }}>
            <Text style={[styles.statValue, { color: cardText }]}>{formatPrice(stats.median_price ?? 0)}</Text>
            <Text style={[styles.statLabel, { color: cardSubtle }]}>Median</Text>
          </View>
        </View> */}
        <View style={styles.statItem}>
          <DollarSign size={20} color={cardTint} />
          <View style={{ marginLeft: 8 }}>
            <Text style={[styles.statValue, { color: cardText }]}>{formatPrice(stats.min_price)}</Text>
            <Text style={[styles.statLabel, { color: cardSubtle }]}>Min</Text>
          </View>
        </View>
        <View style={styles.statItem}>
          <DollarSign size={20} color={cardTint} />
          <View style={{ marginLeft: 8 }}>
            <Text style={[styles.statValue, { color: cardText }]}>{formatPrice(stats.max_price)}</Text>
            <Text style={[styles.statLabel, { color: cardSubtle }]}>Max</Text>
          </View>
        </View>
        <View style={styles.statItem}>
          <Users size={20} color={cardTint} />
          <View style={{ marginLeft: 8 }}>
            <Text style={[styles.statValue, { color: cardText }]}>{stats.results}</Text>
            <Text style={[styles.statLabel, { color: cardSubtle }]}>Results</Text>
          </View>
        </View>
        {stats.unique_sellers !== undefined && (
          <View style={styles.statItem}>
            <Users size={20} color={cardTint} />
            <View style={{ marginLeft: 8 }}>
              <Text style={[styles.statValue, { color: cardText }]}>{stats.unique_sellers}</Text>
              <Text style={[styles.statLabel, { color: cardSubtle }]}>Sellers</Text>
            </View>
          </View>
        )}
        {stats.market_activity && (
          <View style={styles.statItem}>
            <TrendingUp size={20} color={cardTint} />
            <View style={{ marginLeft: 8 }}>
              <Text style={[styles.statValue, { color: cardText }]}>{stats.market_activity}</Text>
              <Text style={[styles.statLabel, { color: cardSubtle }]}>Activity</Text>
            </View>
          </View>
        )}
        {stats.most_recent_sale && (
          <View style={styles.statItem}>
            <Clock size={20} color={cardTint} />
            <View style={{ marginLeft: 8 }}>
              <Text style={[styles.statValue, { color: cardText }]}>{formatPrice(stats.most_recent_sale.price ?? 0)}</Text>
              <Text style={[styles.statLabel, { color: cardSubtle }]}>Recent</Text>
              <Text style={[styles.statSubLabel, { color: cardText }]}> {
                (() => {
                  const d = stats.most_recent_sale.date;
                  if (!d) return '--';
                  const parsed = new Date(d);
                  if (parsed.toString() === 'Invalid Date') return d;
                  return parsed.toLocaleDateString();
                })()
              } </Text>
            </View>
          </View>
        )}
        {/* {profit !== null && (
          <View style={styles.statItem}>
            <DollarSign size={20} color={profit > 0 ? cardSuccess : cardError} />
            <View style={{ marginLeft: 8 }}>
              <Text style={[styles.statValue, { color: profit > 0 ? cardSuccess : cardError }]}>{profit > 0 ? '+' : ''}{profit.toFixed(2)}</Text>
              <Text style={[styles.statLabel, { color: cardSubtle }]}>Profit/Loss</Text>
            </View>
          </View>
        )} */}
      </View>

      <View style={styles.scoreRow}>
        <Award size={18} color={cardSuccess} />
        <Text style={[styles.scoreLabel, { color: cardText }]}>Resaleability</Text>
        <Text style={[styles.scoreValue, { color: cardSuccess }]}>{stats.resaleability_score}</Text>
      </View>
      <ProgressBar progress={stats.resaleability_score / 100} color="#2ecc40" />

      {/* <View style={styles.scoreRow}>
        <ThumbsUp size={18} color={cardTint} />
        <Text style={[styles.scoreLabel, { color: cardText }]}>Match Quality</Text>
        <Text style={[styles.scoreValue, { color: cardTint }]}>{stats.match_quality}%</Text>
      </View> */}
      {/* <ProgressBar progress={stats.match_quality / 100} color="#0074d9" /> */}

      {/* Margin/Profit Row */}
      {margin !== null && (
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <DollarSign size={16} color={profitColor} style={{ marginRight: 4 }} />
              <Text style={[styles.scoreLabel, { color: cardText, fontSize: 14, marginLeft: 0, fontWeight: 'bold' }]}>Your Margin</Text>
            </View>
            <Text style={[styles.scoreValue, { color: profitColor, fontSize: 14 }]}>{margin > 0 ? '+' : ''}{margin.toFixed(1)}%</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <ProgressBar progress={Math.max(0, Math.min(1, margin))} color={profitColor} />
            </View>
            <View style={{
              backgroundColor: profitColor,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 4,
              minWidth: 60,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                {(profit ?? 0) > 0 ? '$' : ''}{(profit ?? 0).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
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
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  statItem: {
    width: '33.33%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingRight: 4,
  },
  statValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textAlign: 'left',
  },
  statSubLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#aaa',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  scoreLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    marginLeft: 8,
    marginRight: 4,
  },
  scoreValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    marginLeft: 8,
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  activityText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginLeft: 6,
  },
}); 