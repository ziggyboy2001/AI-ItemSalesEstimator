import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Platform, TextInput, TouchableOpacity, Alert, Linking } from 'react-native';
import { ProgressBarAndroid } from 'react-native';
import { DollarSign, TrendingUp, Clock, Award, ThumbsUp, Users, ChevronRight, ShoppingBag, Camera } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColor } from '@/constants/useThemeColor';
import { supabase } from '@/services/supabaseClient';
import { searchByImage as ebaySearchByImage, simplifyItemTitle } from '@/services/ebayApi';
import { generateGoogleShoppingSearchURL, generateGoogleLensURL } from '@/services/googleImageSearch';

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
    itemId?: string;
    title?: string;
    image?: string;
    url?: string;
    data_source?: string;
    source?: string;
    market_summary?: string;
  };
  firstItem?: {
    itemId?: string;
    title?: string;
    image?: string;
    url?: string;
    additionalImages?: Array<{ imageUrl: string }>;
  };
  purchasePrice?: number;
  searchTitle?: string;
  onViewAnalysis?: () => void;
  selectedImage?: string; // Base64 image for Google searches
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

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim() !== '';
}

export default function SearchStatsCard({ stats, firstItem, purchasePrice, searchTitle, onViewAnalysis, selectedImage }: SearchStatsCardProps) {
  const [locked, setLocked] = useState(false);
  const [haulId, setHaulId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id ?? null));
  }, []);
  useEffect(() => {
    const fetchHaul = async () => {
      if (!userId) return;
      const { data: hauls } = await supabase
        .from('hauls')
        .select('*')
        .eq('user_id', userId)
        .eq('finished', false)
        .order('created_at', { ascending: false })
        .limit(1);
      if (hauls && hauls[0]) setHaulId(hauls[0].id);
      else setHaulId(null);
    };
    if (userId) fetchHaul();
  }, [userId]);
  const handleLock = async () => {
    // Ensure submittedPrice is set from inputValue if not already
    let priceToUse = submittedPrice;
    if (priceToUse === undefined) {
      const parsed = parseFloat(inputValue);
      if (!isNaN(parsed)) {
        setSubmittedPrice(parsed);
        priceToUse = parsed;
      } else {
        Alert.alert('Error', 'Please enter a valid purchase price before locking to haul.');
        return;
      }
    }
    if (!userId) return;
    let currentHaulId = haulId;
    if (!currentHaulId) {
      // Create a new haul
      const { data, error } = await supabase.from('hauls').insert({ user_id: userId, name: `Haul ${new Date().toLocaleDateString()}` }).select();
      if (data && data[0]) currentHaulId = data[0].id;
    }
    if (!currentHaulId) return;
    // Add item to haul_items
    console.log('LOCK TO HAUL: priceToUse', priceToUse);
    const margin = stats && priceToUse !== undefined ? (Number(stats.average_price) - Number(priceToUse)) : 0;
    
    // Prepare additional images array
    const additionalImages = firstItem?.additionalImages?.map((img: { imageUrl: string }) => img.imageUrl) || [];
    
    await supabase.from('haul_items').insert({
      haul_id: currentHaulId,
      ebay_item_id: firstItem?.itemId || stats?.itemId || '',
      title: searchTitle || firstItem?.title || stats?.title || '',
      image_url: firstItem?.image || stats?.image || '',
      additional_images: additionalImages,
      sale_price: stats?.average_price || 0,
      purchase_price: priceToUse !== undefined ? priceToUse : 0,
      margin,
      link: firstItem?.url || stats?.url || '',
      locked: true,
    });
    setLocked(true);
  };
  if (!stats) return null;

  // Local state for input and submitted price
  const [inputValue, setInputValue] = useState(purchasePrice ? purchasePrice.toString() : '');
  const [submittedPrice, setSubmittedPrice] = useState<number | undefined>(purchasePrice);

  // THEME COLORS
  const backgroundColor = useThemeColor('background');
  const cardText = useThemeColor('text');
  const cardSubtle = useThemeColor('tabIconDefault');
  const cardTint = useThemeColor('tint');
  const cardSuccess = useThemeColor('success');
  const cardError = useThemeColor('error');
  const cardWarning = useThemeColor('warning');

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;

  // Margin/Profit Row
  const showMargin = submittedPrice != null && stats.average_price > 0;
  let fill = 0;
  let barColor = cardSuccess;
  let profit = 0;
  let margin = 0;
  if (showMargin) {
    profit = stats.average_price - submittedPrice!;
    margin = (profit / submittedPrice!) * 100;
    fill = Math.min(1, submittedPrice! / stats.average_price);
    if (submittedPrice! > stats.average_price) {
      barColor = cardError;
    } else if (fill >= 0.8) {
      barColor = cardWarning;
    } else {
      barColor = cardSuccess;
    }
  }

  return (
    <Animated.View 
      style={[styles.container, { backgroundColor, shadowColor: cardSubtle }]}
      entering={FadeInDown.delay(300).duration(400)}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: cardText }]}>Market Snapshot</Text>
        {(stats.data_source || stats.source) && (
          <View style={[styles.sourceBadge, { backgroundColor: (stats.data_source === 'ai_web_search' || stats.data_source === 'ebay_current_listings') ? cardTint + '20' : cardTint + '20' }]}>
            <Text style={[styles.sourceText, { color: (stats.data_source === 'ai_web_search' || stats.data_source === 'ebay_current_listings') ? cardTint : cardTint }]}>
              {(stats.data_source === 'ai_web_search' || stats.data_source === 'ebay_current_listings') ? 'Live Market Data' : 'Historical Sales Data'}
            </Text>
          </View>
        )}
      </View>
      {/* Purchase Price Input */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <TextInput
          style={{
            flex: 1,
            height: 40,
            borderColor: cardSubtle,
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 12,
            color: cardText,
            backgroundColor,
            fontSize: inputValue ? 16 : 14,
            marginRight: 8,
            fontWeight: inputValue ? 'bold' : 'normal',
          }}
          placeholder="Enter asking price to see margins"
          placeholderTextColor={cardSubtle}
          keyboardType="numeric"
          value={inputValue ? `$${inputValue}` : ''}
          onChangeText={(text) => setInputValue(text.replace('$', ''))}
        />
        <TouchableOpacity
          style={{
            backgroundColor: backgroundColor, 
            borderColor: cardTint,
            borderWidth: 1,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 8,
          }}
          onPress={() => {
            const val = parseFloat(inputValue);
            if (!isNaN(val)) setSubmittedPrice(val);
          }}
        >
          <Text style={{ color: cardTint, fontWeight: 'bold' }}>Submit</Text>
        </TouchableOpacity>
      </View>

      {showMargin && !locked && (
        <TouchableOpacity style={{ marginBottom: 8, backgroundColor: cardTint, borderRadius: 8, padding: 12, alignItems: 'center' }} onPress={handleLock}>
          <Text style={{ color: "#000000", fontWeight: 'bold' }}>Lock to Haul</Text>
        </TouchableOpacity>
      )}
      {locked && (
        <View style={{ marginBottom: 8, backgroundColor: backgroundColor, borderRadius: 8, padding: 12, alignItems: 'center' }}>
          <Text style={{ color: '#2ecc40', fontWeight: 'bold' }}>Locked to Haul!</Text>
        </View>
      )}

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <DollarSign size={20} color={cardTint} />
          <View style={{ marginLeft: 8 }}>
            <Text style={[styles.statValue, { color: cardText }]}>{formatPrice(stats.average_price)}</Text>
            <Text style={[styles.statLabel, { color: cardSubtle }]}>
              {stats.data_source === 'ai_web_search' ? 'Avg. Current' : 'Avg. Price'}
            </Text>
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
            <Text style={[styles.statLabel, { color: cardSubtle }]}>
              {stats.data_source === 'ai_web_search' ? 'Listings' : 'Results'}
            </Text>
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
            <View style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statValue, { color: cardText }]}>{stats.market_activity}</Text>
                <Text style={[styles.statLabel, { color: cardSubtle }]}>Activity</Text>
              </View>
              

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
        {/* {(stats.data_source || stats.source) && (
          <View style={[styles.sourceBadge, { backgroundColor: stats.data_source === 'ai_web_search' ? cardTint + '20' : cardTint + '20' }]}>
            <Text style={[styles.sourceText, { color: stats.data_source === 'ai_web_search' ? cardTint : cardTint }]}>
              {stats.data_source === 'ai_web_search' ? 'Live Market Data' : '📊 Historical Sales Data'}
            </Text>
          </View>
        )} */}

                      {/* Google search buttons - appear when image search is active */}
                      {selectedImage && (
                <View style={{ flexDirection: 'column', gap: 4 }}>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        const ebayResults = await ebaySearchByImage({
                          image: selectedImage,
                          limit: 1
                        });
                        
                        if (ebayResults.itemSummaries && ebayResults.itemSummaries.length > 0) {
                          const identifiedTitle = ebayResults.itemSummaries[0].title;
                          const simplifiedTitle = await simplifyItemTitle(identifiedTitle);
                          const shoppingUrl = generateGoogleShoppingSearchURL(simplifiedTitle);
                          Linking.openURL(shoppingUrl);
                        } else {
                          Alert.alert('Error', 'Could not identify the item. Please try again.');
                        }
                      } catch (err) {
                        Alert.alert('Error', 'Failed to identify item for Google Shopping search.');
                      }
                    }}
                    style={[styles.googleButton, { borderColor: cardSubtle }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <ShoppingBag size={12} color={cardSubtle} />
                      <Text style={[styles.googleButtonText, { color: cardSubtle }]}>Google Shop</Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => {
                      const lensUrl = generateGoogleLensURL();
                      Linking.openURL(lensUrl);
                    }}
                    style={[styles.googleButton, { borderColor: cardSubtle }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Camera size={12} color={cardSubtle} />
                      <Text style={[styles.googleButtonText, { color: cardSubtle }]}>Google Lens</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
        
        {(stats.data_source === 'ai_web_search' || stats.data_source === 'ebay_current_listings') && (
          <View style={[styles.aiNoteContainer, { backgroundColor: backgroundColor }]}>
            <Text style={[styles.aiNoteText, { color: cardSubtle }]}>
              💡 Showing current listing prices from multiple sources - not historical sales
            </Text>
          </View>
        )}
        
        {/* {stats.data_source === 'ai_web_search' && stats.market_summary && onViewAnalysis && (
          <TouchableOpacity 
            style={[styles.analysisButton]} 
            onPress={onViewAnalysis}
          >
            <Text style={[styles.analysisButtonText, { color: cardTint }]}>
              📊 View Market Analysis
            </Text>
            <ChevronRight size={20} color={cardTint} />
          </TouchableOpacity>
        )} */}
      </View>

      {/* <View style={styles.scoreRow}>
        <Award size={18} color={cardSuccess} />
        <Text style={[styles.scoreLabel, { color: cardText }]}>Resaleability</Text>
        <Text style={[styles.scoreValue, { color: cardSuccess }]}>{stats.resaleability_score}</Text>
      </View>
      <ProgressBar progress={stats.resaleability_score / 100} color="#2ecc40" /> */}

      {/* <View style={styles.scoreRow}>
        <ThumbsUp size={18} color={cardTint} />
        <Text style={[styles.scoreLabel, { color: cardText }]}>Match Quality</Text>
        <Text style={[styles.scoreValue, { color: cardTint }]}>{stats.match_quality}%</Text>
      </View> */}
      {/* <ProgressBar progress={stats.match_quality / 100} color="#0074d9" /> */}

      {/* Margin/Profit Row */}
      {showMargin && (
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <DollarSign size={16} color={barColor} style={{ marginRight: 4 }} />
              <Text style={[styles.scoreLabel, { color: cardText, fontSize: 14, marginLeft: 0, fontWeight: 'bold' }]}>Your Margin</Text>
            </View>
            <Text style={[styles.scoreValue, { color: barColor, fontSize: 14 }]}>{margin > 0 ? '+' : ''}{margin.toFixed(1)}%</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <ProgressBar progress={fill} color={barColor} />
            </View>
            <View style={{
              backgroundColor: barColor,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 4,
              minWidth: 60,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                {profit > 0 ? '+' : ''}{formatPrice(profit)}
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
    marginBottom: 16,
    // shadowOffset: { width: 0, height: 1 },
    // shadowOpacity: 0.2,
    // shadowRadius: 4,
    elevation: 2,
  },
  header: {
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  sourceBadge: {
    padding: 4,
    borderRadius: 8,
    marginVertical: 12,
    height: 24,
  },
  sourceText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  aiNoteContainer: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderRadius: 4,
    marginTop: 8,
    backgroundColor: '#f0f0f0',
  },
  aiNoteText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  analysisButton: {
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  analysisButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    marginRight: 8,
  },
  googleButton: {
    padding: 6,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 4,
    minWidth: 80,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },
}); 