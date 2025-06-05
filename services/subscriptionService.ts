import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionTier, UserSubscription, getFeatureFlags } from '@/types/subscription';

// Supabase client - you'll need to import your configured client
const SUPABASE_URL = 'https://sxkrkcxumaphascahdxz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4a3JrY3h1bWFwaGFzY2FoZHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3NTM1OTQsImV4cCI6MjA2MzMyOTU5NH0.1CDLFPztnmcFD3ekqIl36RGyMQ0Dqv8LNQ3PBgoD4II';

// Define scan limits for each tier
const SCAN_LIMITS = {
  free: 3,
  hobby: 25,     // Updated from 'basic' to 'hobby'
  pro: 100,      // Updated from 'premium' to 'pro'
  business: 100, // Business tier
  unlimited: -1
} as const;

// Valid scan types
type ScanType = 'current_text' | 'current_image' | 'sold_text';

interface ScanUsageInfo {
  used: number;
  limit: number;
  remaining: number;
  breakdown: {
    current_text: number;
    current_image: number;
    sold_text: number;
  };
}

export class SubscriptionService {
  /**
   * Check if user can perform a scan based on their subscription limits
   */
  static async canUserScan(
    userId: string | null,
    deviceId: string,
    scanType: ScanType
  ): Promise<{ canScan: boolean; reason?: string; usageInfo: ScanUsageInfo }> {
    try {
      // Get user subscription
      const subscription = await this.getUserSubscription(userId, deviceId);
      
      // Get current usage
      const usageInfo = await this.getUsageInfo(userId, deviceId);
      
      // Unlimited tier can always scan
      if (subscription.tier === 'unlimited') {
        return { 
          canScan: true, 
          usageInfo: {
            ...usageInfo,
            limit: -1,
            remaining: -1
          }
        };
      }
      
      const limit = SCAN_LIMITS[subscription.tier];
      const canScan = usageInfo.used < limit;
      
      if (!canScan) {
        const tierNames = {
          free: 'Free',
          hobby: 'Hobby',
          pro: 'Pro', 
          business: 'Business',
          unlimited: 'Unlimited'
        };
        
        return {
          canScan: false,
          reason: `You've reached your ${tierNames[subscription.tier]} plan limit of ${limit} scans this month. Upgrade to continue scanning.`,
          usageInfo
        };
      }
      
      return { canScan: true, usageInfo };
      
    } catch (error) {
      console.error('Error checking scan limits:', error);
      // In case of error, allow the scan but log the issue
      return { 
        canScan: true, 
        usageInfo: { 
          used: 0, 
          limit: 0, 
          remaining: 0, 
          breakdown: { current_text: 0, current_image: 0, sold_text: 0 } 
        } 
      };
    }
  }

  /**
   * Record a successful scan in the database
   */
  static async recordScan(
    userId: string | null,
    deviceId: string,
    scanType: ScanType,
    searchId: string,
    metadata?: any
  ): Promise<void> {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/user_scans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          user_id: userId,
          device_id: deviceId,
          scan_type: scanType,
          search_id: searchId,
          metadata: metadata || null,
          created_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to record scan: ${response.statusText}`);
      }

      console.log(`✅ Scan recorded: ${scanType}`);
      
    } catch (error) {
      console.error('Error recording scan:', error);
      // Don't throw - we don't want to break the user flow if scan recording fails
    }
  }

  /**
   * Get user subscription from database
   */
  static async getUserSubscription(
    userId: string | null, 
    deviceId: string
  ): Promise<UserSubscription> {
    try {
      // Query by user_id first, then device_id if no user
      const queryParam = userId ? `user_id=eq.${userId}` : `device_id=eq.${deviceId}&user_id=is.null`;
      
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/user_subscriptions?${queryParam}&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch subscription: ${response.statusText}`);
      }

      const subscriptions = await response.json();
      
      if (subscriptions.length === 0) {
        // No subscription found, create free subscription
        return await this.createFreeSubscription(userId, deviceId);
      }

      const dbSub = subscriptions[0];
      
      // Convert database subscription to UserSubscription format
      const subscription: UserSubscription = {
        userId: userId || deviceId,
        tier: dbSub.subscription_type as SubscriptionTier,
        paymentMethod: 'external',
        isActive: dbSub.status === 'active',
        currentPeriodStart: new Date(dbSub.current_period_start || Date.now()),
        currentPeriodEnd: new Date(dbSub.current_period_end || Date.now() + 30 * 24 * 60 * 60 * 1000),
        scansUsed: 0, // Will be populated by usage info
        scansRemaining: 0, // Will be calculated
        autoRenew: !!dbSub.stripe_subscription_id,
        features: getFeatureFlags(dbSub.subscription_type as SubscriptionTier).hasAdvancedSearch ? ['advanced_search'] : [],
        stripeCustomerId: dbSub.stripe_customer_id,
        stripeSubscriptionId: dbSub.stripe_subscription_id
      };

      return subscription;
      
    } catch (error) {
      console.error('Error fetching subscription:', error);
      // Fallback to free subscription
      return await this.createFreeSubscription(userId, deviceId);
    }
  }

  /**
   * Create a free subscription for new users
   */
  static async createFreeSubscription(
    userId: string | null,
    deviceId: string
  ): Promise<UserSubscription> {
    try {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      
      // Insert into database
      const response = await fetch(`${SUPABASE_URL}/rest/v1/user_subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          user_id: userId,
          device_id: deviceId,
          subscription_type: 'free',
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: nextMonth.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create subscription: ${response.statusText}`);
      }

      const freeSubscription: UserSubscription = {
        userId: userId || deviceId,
        tier: 'free',
        paymentMethod: 'external',
        isActive: true,
        currentPeriodStart: now,
        currentPeriodEnd: nextMonth,
        scansUsed: 0,
        scansRemaining: 3,
        autoRenew: false,
        features: getFeatureFlags('free').hasAdvancedSearch ? ['advanced_search'] : []
      };

      console.log('✅ Created free subscription');
      return freeSubscription;
      
    } catch (error) {
      console.error('Error creating free subscription:', error);
      // Return a default free subscription even if database fails
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      
      return {
        userId: userId || deviceId,
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
    }
  }

  /**
   * Get current month usage for user
   */
  static async getCurrentMonthUsage(
    userId: string | null,
    deviceId: string
  ): Promise<number> {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      
      // First check monthly_usage_summary for optimized lookup
      const summaryQuery = userId ? `user_id=eq.${userId}` : `user_id=is.null`;
      
      const summaryResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/monthly_usage_summary?${summaryQuery}&year=eq.${year}&month=eq.${month}&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          }
        }
      );

      if (summaryResponse.ok) {
        const summaries = await summaryResponse.json();
        if (summaries.length > 0) {
          return summaries[0].scans_used;
        }
      }

      // Fallback to counting scans directly
      const startOfMonth = new Date(year, month - 1, 1).toISOString();
      const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();
      
      const userQuery = userId ? `user_id=eq.${userId}` : `device_id=eq.${deviceId}&user_id=is.null`;
      
      const scansResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/user_scans?${userQuery}&created_at=gte.${startOfMonth}&created_at=lte.${endOfMonth}&select=id`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          }
        }
      );

      if (scansResponse.ok) {
        const scans = await scansResponse.json();
        return scans.length;
      }

      return 0;
      
    } catch (error) {
      console.error('Error fetching current month usage:', error);
      return 0;
    }
  }

  /**
   * Get detailed usage breakdown by scan type
   */
  static async getUsageBreakdown(
    userId: string | null,
    deviceId: string
  ): Promise<{
    current_text: number;
    current_image: number;
    sold_text: number;
  }> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      
      const userQuery = userId ? `user_id=eq.${userId}` : `device_id=eq.${deviceId}&user_id=is.null`;
      
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/user_scans?${userQuery}&created_at=gte.${startOfMonth}&created_at=lte.${endOfMonth}&select=scan_type`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch usage breakdown: ${response.statusText}`);
      }

      const scans = await response.json();
      
      const breakdown = {
        current_text: 0,
        current_image: 0,
        sold_text: 0
      };

      scans.forEach((scan: { scan_type: string }) => {
        if (scan.scan_type in breakdown) {
          breakdown[scan.scan_type as keyof typeof breakdown]++;
        }
      });

      return breakdown;
      
    } catch (error) {
      console.error('Error fetching usage breakdown:', error);
      return {
        current_text: 0,
        current_image: 0,
        sold_text: 0
      };
    }
  }

  /**
   * Reset monthly usage for a new billing period
   * This should be called by a scheduled job at the start of each month
   */
  static async resetMonthlyUsage(
    userId: string | null,
    deviceId: string
  ): Promise<void> {
    try {
      // Note: We don't actually delete scan records (for audit purposes)
      // Monthly limits are enforced by looking at scans within the current month
      // This function exists for future enhancement where we might need
      // to update subscription period dates or clear cached usage data
      
      console.log('Monthly usage reset called for:', { userId, deviceId });
      
      // For now, this is a no-op since our system calculates monthly usage
      // dynamically by filtering scans by created_at date
      // In a production system, you might want to:
      // 1. Update subscription period dates
      // 2. Clear cached usage summaries
      // 3. Send usage reports
      
    } catch (error) {
      console.error('Error resetting monthly usage:', error);
      throw error;
    }
  }

  /**
   * Check if user's subscription period has expired and needs renewal
   */
  static async checkSubscriptionExpiry(
    userId: string | null,
    deviceId: string
  ): Promise<void> {
    try {
      const subscription = await this.getUserSubscription(userId, deviceId);
      const now = new Date();
      
      // Check if subscription has expired
      if (subscription.currentPeriodEnd < now && subscription.isActive) {
        console.log('Subscription expired, resetting to free tier:', {
          userId,
          deviceId,
          expiredDate: subscription.currentPeriodEnd
        });
        
        // Reset to free tier
        await this.createFreeSubscription(userId, deviceId);
      }
    } catch (error) {
      console.error('Error checking subscription expiry:', error);
    }
  }

  /**
   * Get comprehensive usage information
   */
  private static async getUsageInfo(
    userId: string | null,
    deviceId: string
  ): Promise<ScanUsageInfo> {
    const [totalUsage, breakdown] = await Promise.all([
      this.getCurrentMonthUsage(userId, deviceId),
      this.getUsageBreakdown(userId, deviceId)
    ]);

    const subscription = await this.getUserSubscription(userId, deviceId);
    const limit = SCAN_LIMITS[subscription.tier];
    
    return {
      used: totalUsage,
      limit,
      remaining: limit === -1 ? -1 : Math.max(0, limit - totalUsage),
      breakdown
    };
  }

  /**
   * Update subscription tier (for webhook handlers)
   */
  static async updateSubscriptionTier(
    userId: string | null,
    deviceId: string,
    tier: SubscriptionTier,
    stripeSubscriptionId?: string,
    stripeCustomerId?: string
  ): Promise<void> {
    try {
      const queryParam = userId ? `user_id=eq.${userId}` : `device_id=eq.${deviceId}&user_id=is.null`;
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/user_subscriptions?${queryParam}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          subscription_type: tier,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update subscription: ${response.statusText}`);
      }

      console.log(`✅ Subscription updated to ${tier}`);
      
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }
} 