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
      console.log(`🔍 Checking scan limit for ${scanType} on device ${deviceId}`);
      
      const response = await fetch('http://localhost:3000/check-scan-limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          deviceId,
          scanType
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to check scan limit: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ Scan limit check result:`, result);
      
      return {
        canScan: result.canScan,
        reason: result.reason,
        usageInfo: result.usageInfo
      };
      
    } catch (error) {
      console.error('❌ Error checking scan limits:', error);
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
    console.log('🐛 DEBUG - recordScan method called with:', { userId, deviceId, scanType, searchId, metadata });
    
    try {
      console.log(`📝 Recording scan: ${scanType} for device ${deviceId}`);
      console.log('📝 Request details:', { userId, deviceId, scanType, searchId, metadata });
      
      const response = await fetch('http://localhost:3000/record-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          deviceId,
          scanType,
          searchId,
          metadata
        })
      });
      
      console.log('📝 Response status:', response.status);
      console.log('📝 Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('📝 Error response:', errorText);
        throw new Error(`Failed to record scan: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ Scan recorded successfully: ${scanType}`, result);
      
    } catch (error) {
      console.error('❌ Error recording scan:', error);
      // console.error('❌ Error details:', error.message);
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
      console.log(`📋 Getting subscription for device ${deviceId}`);
      
      const response = await fetch(
        `http://localhost:3000/subscription/${deviceId}${userId ? `?userId=${userId}` : ''}`,
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch subscription: ${response.statusText}`);
      }

      const dbSub = await response.json();
      
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

      console.log(`✅ Got subscription: ${subscription.tier} for device ${deviceId}`);
      return subscription;
      
    } catch (error) {
      console.error('❌ Error fetching subscription:', error);
      // Return a default free subscription if API fails
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

  // Removed - createFreeSubscription now handled by server API

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
        console.log('Subscription expired, but expiry handling is now managed by server webhooks:', {
          userId,
          deviceId,
          expiredDate: subscription.currentPeriodEnd
        });
        
        // Note: Subscription expiry is now handled by server-side logic
        // via Stripe webhooks and scheduled jobs
      }
    } catch (error) {
      console.error('Error checking subscription expiry:', error);
    }
  }

  /**
   * Get total bonus scans from scan credits table
   */
  static async getBonusScansFromCredits(deviceId: string): Promise<number> {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/scan_credits?device_id=eq.${deviceId}&select=scan_credits`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          }
        }
      );

      if (!response.ok) {
        console.warn('Failed to fetch scan credits:', response.statusText);
        return 0;
      }

      const credits = await response.json();
      const totalCredits = credits.reduce((sum: number, credit: { scan_credits: number }) => 
        sum + credit.scan_credits, 0
      );

      console.log(`📊 Bonus scans from credits for device ${deviceId}: ${totalCredits}`);
      return totalCredits;
      
    } catch (error) {
      console.error('Error fetching bonus scans from credits:', error);
      return 0;
    }
  }

  /**
   * Get comprehensive subscription status from backend (single source of truth)
   */
  static async getSubscriptionStatus(
    userId: string | null,
    deviceId: string
  ): Promise<{
    subscription: UserSubscription;
    usage: {
      used: number;
      breakdown: { current_text: number; current_image: number; sold_text: number };
      month: string;
    };
    scans: {
      baseLimit: number;
      bonusScans: number;
      totalLimit: number;
      used: number;
      remaining: number;
    };
    canScan: boolean;
  }> {
    try {
      const queryParam = userId ? `?userId=${userId}` : '';
             const response = await fetch(
         `http://localhost:3000/subscription-status/${deviceId}${queryParam}`,
         {
           headers: {
             'Content-Type': 'application/json',
           },
         }
       );

      if (!response.ok) {
        throw new Error(`Failed to fetch subscription status: ${response.statusText}`);
      }

      const status = await response.json();
      
             // Convert to UserSubscription format
       const subscription: UserSubscription = {
         userId: status.subscription.device_id || deviceId,
         tier: status.subscription.subscription_type,
         paymentMethod: 'external',
         isActive: status.subscription.is_active || true,
         currentPeriodStart: new Date(status.subscription.current_period_start || Date.now()),
         currentPeriodEnd: new Date(status.subscription.current_period_end || Date.now() + 30 * 24 * 60 * 60 * 1000),
         scansUsed: status.scans.used,
         scansRemaining: status.scans.remaining,
         autoRenew: status.subscription.auto_renew || false,
         features: []
       };

      return {
        ...status,
        subscription
      };
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive usage information including bonus scans from scan credits
   * @deprecated Use getSubscriptionStatus instead for single source of truth
   */
  private static async getUsageInfo(
    userId: string | null,
    deviceId: string
  ): Promise<ScanUsageInfo> {
    const [totalUsage, breakdown, bonusScans] = await Promise.all([
      this.getCurrentMonthUsage(userId, deviceId),
      this.getUsageBreakdown(userId, deviceId),
      this.getBonusScansFromCredits(deviceId)
    ]);

    const subscription = await this.getUserSubscription(userId, deviceId);
    const baseLimit = SCAN_LIMITS[subscription.tier];
    
    // Add bonus scans to the limit (unlimited tier stays unlimited)
    const totalLimit = baseLimit === -1 ? -1 : baseLimit + bonusScans;
    
    return {
      used: totalUsage,
      limit: totalLimit,
      remaining: totalLimit === -1 ? -1 : Math.max(0, totalLimit - totalUsage),
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