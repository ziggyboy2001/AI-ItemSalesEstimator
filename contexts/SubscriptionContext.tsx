import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionTier, UserSubscription, FeatureFlags, getFeatureFlags } from '@/types/subscription';
import { canPerformScan } from '@/services/stripeService';
import { SubscriptionService } from '@/services/subscriptionService';
import { useDeviceId } from '@/hooks/useDeviceId';

interface SubscriptionContextType {
  // Subscription state
  subscription: UserSubscription | null;
  loading: boolean;
  
  // Feature flags
  features: FeatureFlags;
  
  // Scan management
  canScan: boolean;
  scansRemaining: number;
  scansUsed: number;
  
  // Scan breakdown by type
  scanBreakdown: {
    current_text: number;
    current_image: number;
    sold_text: number;
  };
  
  // Actions
  updateSubscription: (subscription: UserSubscription) => Promise<void>;
  useScans: (count: number) => Promise<boolean>;
  addScans: (count: number) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  resetToFree: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const SUBSCRIPTION_STORAGE_KEY = '@bidpeek_subscription';

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanBreakdown, setScanBreakdown] = useState({
    current_text: 0,
    current_image: 0,
    sold_text: 0
  });
  
  const { deviceId, isLoading: deviceIdLoading } = useDeviceId();

  // Calculate derived state
  const features = subscription ? getFeatureFlags(subscription.tier) : getFeatureFlags('free');
  const scansUsed = subscription?.scansUsed || 0;
  
  // Handle unlimited scans for unlimited tier
  const getScansLimit = () => {
    if (!subscription) return 3; // Free tier default
    
    if (subscription.tier === 'unlimited') {
      return -1; // Unlimited
    }
    
    // Define scan limits per tier
    const limits = {
      free: 3,
      hobby: 25,
      pro: 100,
      business: 100,
      unlimited: -1
    };
    
    return limits[subscription.tier] || 3;
  };
  
  // Use scansRemaining directly from backend (which includes bonus scans)  
  const scansRemaining = subscription?.scansRemaining ?? 0;
  const scansLimit = subscription?.tier === 'unlimited' ? -1 : (scansUsed + scansRemaining);
  const canScan = subscription?.tier === 'unlimited' ? true : scansRemaining > 0;

  // Load subscription when device ID is ready
  useEffect(() => {
    if (!deviceIdLoading && deviceId) {
      loadSubscription();
    }
  }, [deviceId, deviceIdLoading]);

  const loadSubscription = async () => {
    if (!deviceId) return;
    
    try {
      setLoading(true);
      
      // Load comprehensive status from backend (single source of truth)
      const status = await SubscriptionService.getSubscriptionStatus(null, deviceId);
      
      setSubscription(status.subscription);
      setScanBreakdown(status.usage.breakdown);
      
      // Backup to AsyncStorage
      await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(status.subscription));
      
      console.log('✅ Subscription status loaded from backend:', {
        tier: status.subscription.tier,
        baseLimit: status.scans.baseLimit,
        bonusScans: status.scans.bonusScans,
        totalLimit: status.scans.totalLimit,
        used: status.scans.used,
        remaining: status.scans.remaining,
        breakdown: status.usage.breakdown
      });
      
    } catch (error) {
      console.error('Failed to load subscription from database:', error);
      
      // Fallback: Try AsyncStorage
      try {
        const stored = await AsyncStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
        if (stored) {
          const parsedSubscription = JSON.parse(stored);
          parsedSubscription.currentPeriodStart = new Date(parsedSubscription.currentPeriodStart);
          parsedSubscription.currentPeriodEnd = new Date(parsedSubscription.currentPeriodEnd);
          
          const now = new Date();
          if (parsedSubscription.currentPeriodEnd > now && parsedSubscription.isActive) {
            setSubscription(parsedSubscription);
            console.log('📱 Loaded subscription from AsyncStorage fallback');
          } else {
            await resetToFree();
          }
        } else {
          // If no stored subscription, load from backend which will create free subscription if needed
          await loadSubscription();
          return;
        }
              } catch (fallbackError) {
          console.error('Failed AsyncStorage fallback:', fallbackError);
          // Backend will create free subscription if needed
          const status = await SubscriptionService.getSubscriptionStatus(null, deviceId);
          setSubscription(status.subscription);
          setScanBreakdown(status.usage.breakdown);
        }
    } finally {
      setLoading(false);
    }
  };

  const createFreeSubscription = async () => {
    if (!deviceId) return;
    
    try {
      // Clear any cached data first
      await AsyncStorage.removeItem(SUBSCRIPTION_STORAGE_KEY);
      console.log('🗑️ Cleared cached subscription data');
      
      // Backend will create free subscription automatically when fetching status
      const status = await SubscriptionService.getSubscriptionStatus(null, deviceId);
      setSubscription(status.subscription);
      setScanBreakdown(status.usage.breakdown);
      
      // Backup to AsyncStorage
      await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(status.subscription));
      
      console.log('✅ Created free subscription');
    } catch (error) {
      console.error('Failed to create free subscription:', error);
      
      // Fallback to local-only subscription
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      
      const fallbackSubscription: UserSubscription = {
        userId: deviceId,
        tier: 'free',
        paymentMethod: 'external',
        isActive: true,
        currentPeriodStart: now,
        currentPeriodEnd: nextMonth,
        scansUsed: 0,
        scansRemaining: 3,
        autoRenew: false,
        features: []
      };
      
      setSubscription(fallbackSubscription);
      await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(fallbackSubscription));
    }
  };

  const updateSubscription = async (newSubscription: UserSubscription) => {
    try {
      setSubscription(newSubscription);
      await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(newSubscription));
      console.log('✅ Subscription updated:', newSubscription.tier);
    } catch (error) {
      console.error('❌ Failed to update subscription:', error);
    }
  };

  const useScans = async (count: number = 1): Promise<boolean> => {
    if (!subscription || !deviceId) return false;
    
    // This method is kept for backward compatibility
    // The actual scan recording should be done by SubscriptionService.recordScan()
    // after successful search operations
    
    if (subscription.tier === 'unlimited') {
      console.log(`✅ Used ${count} scan(s). Unlimited remaining.`);
      return true;
    }
    
    const totalScans = getScansLimit();
    const newScansUsed = subscription.scansUsed + count;
    
    if (newScansUsed > totalScans) {
      console.log('🚫 Not enough scans remaining');
      return false;
    }

    const updatedSubscription = {
      ...subscription,
      scansUsed: newScansUsed,
      scansRemaining: Math.max(0, totalScans - newScansUsed)
    };

    await updateSubscription(updatedSubscription);
    console.log(`✅ Used ${count} scan(s). Remaining: ${updatedSubscription.scansRemaining}`);
    return true;
  };

  const addScans = async (count: number) => {
    if (!subscription) return;

    const updatedSubscription = {
      ...subscription,
      scansRemaining: subscription.scansRemaining + count
    };

    await updateSubscription(updatedSubscription);
    console.log(`✅ Added ${count} scan(s). New total: ${updatedSubscription.scansRemaining}`);
  };

  const refreshSubscription = async () => {
    if (!deviceId) return;

    try {
      console.log('🔄 Refreshing subscription status...');
      await loadSubscription();
    } catch (error) {
      console.error('❌ Failed to refresh subscription:', error);
    }
  };

  const refreshUsage = async () => {
    if (!deviceId) return;

    try {
      // Use backend-driven status refresh instead of manual calculation
      await refreshSubscription();
      console.log('🔄 Usage refreshed via subscription refresh');
    } catch (error) {
      console.error('❌ Failed to refresh usage:', error);
    }
  };

  const resetToFree = async () => {
    await createFreeSubscription();
  };

  const value: SubscriptionContextType = {
    subscription,
    loading: loading || deviceIdLoading,
    features,
    canScan,
    scansRemaining,
    scansUsed,
    scanBreakdown,
    updateSubscription,
    useScans,
    addScans,
    refreshSubscription,
    refreshUsage,
    resetToFree
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  const { features } = useSubscription();
  const value = features[flag];
  
  // Handle both boolean and number types (for limits like maxSavedSearches)
  if (typeof value === 'boolean') {
    return value;
  } else if (typeof value === 'number') {
    return value > 0; // Convert numbers to boolean (positive = true)
  }
  
  return false;
}

export function useScansRemaining(): number {
  const { scansRemaining } = useSubscription();
  return scansRemaining;
}

export function useCanScan(): boolean {
  const { canScan } = useSubscription();
  return canScan;
} 