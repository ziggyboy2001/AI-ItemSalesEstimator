import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  SafeAreaView,
  AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Zap, Star, ExternalLink, Check, ShieldCheck, TypeOutline, Camera, BadgeDollarSign } from 'lucide-react-native';

import { useSubscription } from '@/contexts/SubscriptionContext';
import { useThemeColor } from '@/constants/useThemeColor';
import { SUBSCRIPTION_PLANS, SCAN_PACKS } from '@/types/subscription';
import { stripeService, formatPrice, calculateYearlySavings } from '@/services/stripeService';

export default function SubscriptionScreen() {
  const {
    subscription,
    loading,
    scansRemaining,
    scansUsed,
    features,
    scanBreakdown,
    refreshSubscription
  } = useSubscription();

  const backgroundColor = useThemeColor('background');
  const tintColor = useThemeColor('tint');
  const textColor = useThemeColor('text');
  const subtleText = useThemeColor('tabIconDefault');

  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);
  const checkoutInProgress = useRef(false);

  // Listen for app state changes to detect return from browser checkout
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came back to foreground
        if (checkoutInProgress.current) {
          // User returned from checkout, refresh data to check for successful purchase
          console.log('🔄 Returned from checkout, refreshing subscription data...');
          refreshSubscription();
          checkoutInProgress.current = false;
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, [refreshSubscription]);

  // Helper function to get color based on scans remaining
  const getScanUsageColor = (scansRemaining: number, totalScans: number) => {
    if (totalScans <= 0) return tintColor; // Fallback
    
    const usagePercentage = ((totalScans - scansRemaining) / totalScans) * 100;
    
    if (usagePercentage < 60) return '#22C55E'; // Green - plenty left
    if (usagePercentage < 85) return '#F59E0B'; // Yellow/Orange - getting low  
    return '#EF4444'; // Red - very low
  };

  const handleSubscriptionUpgrade = async (tier: 'hobby' | 'pro' | 'business' | 'unlimited', billing: 'monthly' | 'yearly') => {
    try {
      setProcessingPayment(`${tier}_${billing}`);
      
      // Check if payment server is available
      const serverAvailable = await stripeService.checkServerHealth();
      
      if (serverAvailable) {
        // Use direct Stripe checkout via our server
        console.log('💳 Opening Stripe checkout...');
        await stripeService.openCheckoutSession(tier, billing, subscription?.userId || 'anonymous');
      } else {
        // Fallback to web page
        console.log('🌐 Server unavailable, using web page fallback...');
        const paymentUrl = stripeService.generatePaymentUrl(tier, billing, subscription?.userId || 'anonymous');
        
        Alert.alert(
          'Complete Payment in Browser',
          `You'll be redirected to our secure payment page to complete your subscription.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              onPress: async () => {
                const supported = await Linking.canOpenURL(paymentUrl);
                if (supported) {
                  await Linking.openURL(paymentUrl);
                } else {
                  Alert.alert('Error', 'Cannot open payment page on this device.');
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Failed to start upgrade process:', error);
      Alert.alert('Error', 'Failed to start upgrade process. Please try again.');
    } finally {
      setProcessingPayment(null);
    }
  };

  const handleScanPackPurchase = async (packId: string) => {
    try {
      setProcessingPayment(packId);
      
      const pack = SCAN_PACKS.find(p => p.id === packId);
      if (!pack) return;

      // Check if payment server is available
      const serverAvailable = await stripeService.checkServerHealth();
      
      if (serverAvailable) {
        // Use direct Stripe checkout via our server
        console.log('💳 Opening scan pack checkout...');
        checkoutInProgress.current = true; // Mark that checkout is starting
        await stripeService.openScanPackCheckout(packId, subscription?.userId || 'anonymous');
      } else {
        // Fallback to manual confirmation
        Alert.alert(
          'Buy Extra Scans',
          `Purchase ${pack.scanCount} scans for ${formatPrice(pack.pricing.external)}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Buy Now',
              onPress: async () => {
                const paymentUrl = stripeService.generateScanPackUrl(packId, subscription?.userId || 'anonymous');
                await Linking.openURL(paymentUrl);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Failed to purchase scan pack:', error);
      Alert.alert('Error', 'Failed to purchase scan pack. Please try again.');
    } finally {
      setProcessingPayment(null);
    }
  };

  const renderCurrentPlan = () => {
    const currentPlan = SUBSCRIPTION_PLANS[subscription?.tier || 'free'];
    const isUnlimited = subscription?.tier === 'unlimited';
    
    // Use sum of breakdown for accurate total
    const actualScansUsed = (scanBreakdown?.sold_text || 0) + 
                           (scanBreakdown?.current_text || 0) + 
                           (scanBreakdown?.current_image || 0);
    
    // Get the base plan limit for display purposes only
    const basePlanLimit = isUnlimited ? -1 : (() => {
      const limits = { free: 3, hobby: 25, pro: 100, business: 100, unlimited: -1 };
      return limits[subscription?.tier || 'free'] || 3;
    })();
    
    // Use scansRemaining from context (includes bonus scans from purchases)
    const actualScansRemaining = scansRemaining;
    const totalScansLimit = isUnlimited ? -1 : actualScansUsed + actualScansRemaining;
    const usagePercentage = isUnlimited ? 0 : (totalScansLimit > 0 ? (actualScansUsed / totalScansLimit) * 100 : 0);

    return (
      <View style={[styles.currentPlanCard, { backgroundColor: subtleText + '10' }]}>
        <View style={styles.planHeader}>
          <View style={styles.planTitleRow}>
            <Crown size={24} color={tintColor} />
            <Text style={[styles.planTitle, { color: textColor }]}>
              {currentPlan.name}
            </Text>
          </View>
          <Text style={[styles.planDescription, { color: subtleText }]}>
            {currentPlan.description}
          </Text>
        </View>

        <View style={styles.usageSection}>
          <Text style={[styles.usageTitle, { color: textColor }]}>
            {isUnlimited ? 'Monthly Activity' : 'Monthly Usage'}
          </Text>
          
          {isUnlimited ? (
            <View style={styles.unlimitedSection}>
              <Text style={[styles.unlimitedText, { color: tintColor }]}>
                ∞ Unlimited Scans
              </Text>
              <Text style={[styles.scansUsedText, { color: textColor }]}>
                {actualScansUsed} scans used this month
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.usageBar}>
                <View style={[styles.usageBarBg, { backgroundColor: subtleText + '20' }]}>
                  <View 
                    style={[
                      styles.usageBarFill, 
                      { 
                        backgroundColor: getScanUsageColor(actualScansRemaining, totalScansLimit),
                        width: `${Math.min(usagePercentage, 100)}%`
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.usageText, { color: textColor }]}>
                  {actualScansUsed} / {totalScansLimit} scans used
                </Text>
              </View>
              <Text style={[styles.scansRemaining, { color: getScanUsageColor(actualScansRemaining, totalScansLimit) }]}>
                {actualScansRemaining} scans remaining
              </Text>
            </>
          )}
          
          {/* Search Type Breakdown */}
          <View style={styles.scanBreakdownSection}>
            <Text style={[styles.breakdownTitle, { color: textColor }]}>Usage by Search Type</Text>
            
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <BadgeDollarSign size={16} color={subtleText} style={{ marginBottom: 4}} />
                    <Text style={[styles.breakdownLabel, { color: subtleText , marginLeft: -4}]}>Sold Items</Text>
                </View>
                <Text style={[styles.breakdownCount, { color: textColor }]}>
                  {scanBreakdown?.sold_text || 0}
                </Text>
              </View>
              
              <View style={styles.breakdownItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TypeOutline size={16} color={subtleText} style={{ marginBottom: 4}} />
                    <Text style={[styles.breakdownLabel, { color: subtleText , marginLeft: -4}]}>Text Searches</Text>
                </View>                
                <Text style={[styles.breakdownCount, { color: textColor }]}>
                  {scanBreakdown?.current_text || 0}
                </Text>
              </View>
              
              <View style={styles.breakdownItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Camera size={16} color={subtleText} style={{ marginBottom: 4}} />
                    <Text style={[styles.breakdownLabel, { color: subtleText , marginLeft: -4}]}>Image Searches</Text>
                </View>
                  <Text style={[styles.breakdownCount, { color: textColor }]}>
                  {scanBreakdown?.current_image || 0}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderSubscriptionTier = (tier: 'hobby' | 'pro' | 'business' | 'unlimited') => {
    const plan = SUBSCRIPTION_PLANS[tier];
    const isCurrentTier = subscription?.tier === tier;
    const yearlySavings = calculateYearlySavings(tier, 'external');

    return (
      <View 
        key={tier}
        style={[
          styles.tierCard,
          { 
            backgroundColor: backgroundColor,
            borderColor: isCurrentTier ? tintColor : subtleText + '30',
            borderWidth: isCurrentTier ? 2 : 1
          }
        ]}
      >
        {tier === 'pro' && (
          <View style={[styles.popularBadge, { backgroundColor: tintColor }]}>
            <Star size={12} color="#000000" />
            <Text style={[styles.popularText, { color: '#000000' }]}>Most Popular</Text>
          </View>
        )}
        {tier === 'unlimited' && (
          <View style={[styles.popularBadge, { backgroundColor: '#FF6B35' }]}>
            <Crown size={12} color="white" />
            <Text style={styles.popularText}>Best Value</Text>
          </View>
        )}

        <View style={styles.tierHeader}>
          <Text style={[styles.tierName, { color: textColor }]}>{plan.name}</Text>
          <Text style={[styles.tierDescription, { color: subtleText }]}>
            {plan.description}
          </Text>
        </View>

        <View style={styles.tierScans}>
          <Text style={[styles.scanCount, { color: tintColor }]}>
            {plan.monthlyScans === -1 ? 'Unlimited scans' : `${plan.monthlyScans} scans/month`}
          </Text>
        </View>

        <View style={styles.tierFeatures}>
          {plan.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Check size={16} color={tintColor} />
              <Text style={[styles.featureText, { color: textColor }]}>{feature}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tierPricing}>
          <View style={styles.pricingRow}>
            <View>
              <Text style={[styles.priceLabel, { color: subtleText }]}>Monthly</Text>
              <Text style={[styles.price, { color: tintColor }]}>
                {formatPrice(plan.pricing.external.monthly)}/mo
              </Text>
              <Text style={[styles.yearlyPrice, { color: subtleText }]}>
                {formatPrice(plan.pricing.external.yearly)}/year (Save {formatPrice(yearlySavings)})
              </Text>
            </View>
          </View>
        </View>

        {!isCurrentTier && (
          <View style={styles.tierActions}>
            <TouchableOpacity
              style={[styles.subscribeButton, { backgroundColor: tintColor }]}
              onPress={() => handleSubscriptionUpgrade(tier, 'monthly')}
              disabled={processingPayment === `${tier}_monthly`}
            >
              <Text style={styles.subscribeButtonText}>
                {processingPayment === `${tier}_monthly` ? 'Processing...' : 'Start Monthly'}
              </Text>
              <ExternalLink size={16} color="#000000" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.yearlyButton, { borderColor: tintColor }]}
              onPress={() => handleSubscriptionUpgrade(tier, 'yearly')}
              disabled={processingPayment === `${tier}_yearly`}
            >
              <Text style={[styles.yearlyButtonText, { color: tintColor }]}>
                {processingPayment === `${tier}_yearly` ? 'Processing...' : `Yearly (Save ${formatPrice(yearlySavings)})`}
              </Text>
              <ExternalLink size={16} color={tintColor} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderScanPacks = () => {
    // Only hide scan packs for unlimited users (they don't need more scans)
    if (subscription?.tier === 'unlimited') {
      return null;
    }

    return (
      <View style={styles.scanPacksSection}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Extra Scans</Text>
        <Text style={[styles.sectionSubtitle, { color: subtleText }]}>
          {scansRemaining <= 3 
            ? 'Purchase additional scans without changing your plan'
            : 'Top up your account with extra scans for busy months'
          }
        </Text>

        <View style={styles.scanPacksGrid}>
          {SCAN_PACKS.map((pack) => (
            <TouchableOpacity
              key={pack.id}
              style={[styles.scanPackCard, { borderColor: subtleText + '30' }]}
              onPress={() => handleScanPackPurchase(pack.id)}
              disabled={processingPayment === pack.id}
            >
              <Zap size={20} color={tintColor} />
              <Text style={[styles.packName, { color: textColor }]}>{pack.name}</Text>
              <Text style={[styles.packPrice, { color: tintColor }]}>
                {formatPrice(pack.pricing.external)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: textColor }]}>Loading subscription...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: textColor }]}>Subscription</Text>
          <Text style={[styles.subtitle, { color: subtleText }]}>
            Manage your BidPeek subscription and usage
          </Text>
        </View>

        {renderCurrentPlan()}
        {renderScanPacks()}

        <View style={styles.upgradeSection}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Upgrade Your Plan</Text>
          <Text style={[styles.sectionSubtitle, { color: subtleText }]}>
            Get more scans and unlock powerful features
          </Text>

          {(['hobby', 'pro', 'business', 'unlimited'] as const).map(renderSubscriptionTier)}
        </View>

        <View style={[styles.savingsCallout, { backgroundColor: subtleText + '10' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ShieldCheck size={24} color={tintColor} style={{ marginBottom: 8, marginRight: 8 }} />
            <Text style={[styles.savingsTitle, { color: tintColor }]}>Secure Online Payment</Text>
          </View>
          <Text style={[styles.savingsText, { color: textColor }]}>
            All payments are processed securely through Stripe. You'll be redirected to complete your purchase safely.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  currentPlanCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
  },
  planHeader: {
    marginBottom: 20,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  planTitle: {
    fontSize: 24,
    fontFamily: 'Inter_600SemiBold',
  },
  planDescription: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  usageSection: {
    gap: 8,
  },
  usageTitle: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  usageBar: {
    gap: 8,
  },
  usageBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  usageBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  usageText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  scansRemaining: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionTitle: {
    fontSize: 24,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 20,
  },
  scanPacksSection: {
    padding: 20,
  },
  scanPacksGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  scanPackCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  packName: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  packPrice: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  upgradeSection: {
    padding: 20,
  },
  tierCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  tierHeader: {
    marginBottom: 16,
  },
  tierName: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  tierDescription: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  tierScans: {
    marginBottom: 16,
  },
  scanCount: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  tierFeatures: {
    gap: 8,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  tierPricing: {
    marginBottom: 20,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  priceLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginBottom: 4,
  },
  price: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  yearlyPrice: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  tierActions: {
    gap: 12,
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  subscribeButtonText: {
    color: '#000000',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  yearlyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  yearlyButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  savingsCallout: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    marginBottom: 40,
  },
  savingsTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
  },
  savingsText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  unlimitedSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unlimitedText: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  scansUsedText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  scanBreakdownSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eaeaea',
  },
  breakdownTitle: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
    textAlign: 'center',
  },
  breakdownCount: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
}); 