export type SubscriptionTier = 'free' | 'hobby' | 'pro' | 'business' | 'unlimited';

export type PaymentMethod = 'external';

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  description: string;
  monthlyScans: number;
  features: string[];
  pricing: {
    external: {
      monthly: number;
      yearly: number;
    };
  };
  stripePriceIds: {
    monthly: string;
    yearly: string;
  };
}

export interface ScanPack {
  id: string;
  name: string;
  scanCount: number;
  pricing: {
    external: number;
  };
  stripePriceId: string;
}

export interface UserSubscription {
  userId: string;
  tier: SubscriptionTier;
  paymentMethod: PaymentMethod;
  isActive: boolean;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  scansUsed: number;
  scansRemaining: number;
  autoRenew: boolean;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    tier: 'free',
    name: 'Basic Explorer',
    description: 'Try all search types with 3 scans',
    monthlyScans: 3,
    features: [
      '3 scans per month',
      'Text search on sold items',
      'Text search on current listings',
      'Image search on current listings',
      '90 days of sold data',
      'Basic search history'
    ],
    pricing: {
      external: { monthly: 0, yearly: 0 }
    },
    stripePriceIds: { monthly: '', yearly: '' }
  },
  hobby: {
    tier: 'hobby',
    name: 'Casual Flipper',
    description: 'Perfect for weekend resellers',
    monthlyScans: 25,
    features: [
      '25 scans per month',
      'All search types included',
      '90 days of sold item data',
      'Save search results',
      'Search history',
      'Basic market insights',
      'eBay affiliate links'
    ],
    pricing: {
      external: { monthly: 3.99, yearly: 39.99 }
    },
    stripePriceIds: { 
      monthly: 'price_1RWQvGR96MkVj8srDUEE5JJA', 
      yearly: 'price_1RWQvNR96MkVj8srTLZz6OEM' 
    }
  },
  pro: {
    tier: 'pro',
    name: 'Serious Reseller',
    description: 'For dedicated resellers and small businesses',
    monthlyScans: 100,
    features: [
      '100 scans per month',
      'All search types included',
      'Full 90 days sold data',
      'Advanced market analysis',
      'Price trend insights',
      'Profit margin calculator',
      'Enhanced search history',
      'Priority search processing'
    ],
    pricing: {
      external: { monthly: 7.99, yearly: 79.99 }
    },
    stripePriceIds: { 
      monthly: 'price_1RWQvYR96MkVj8srXJdwKnPi', 
      yearly: 'price_1RWQvYR96MkVj8sr1HUyp8ac' 
    }
  },
  business: {
    tier: 'business',
    name: 'Power Seller',
    description: 'For high-volume sellers and businesses',
    monthlyScans: 100,
    features: [
      '100 scans per month',
      'All search types included',
      'Complete 90 days sold data',
      'Advanced analytics dashboard',
      'Market trend predictions',
      'Competitive analysis tools',
      'Bulk search capabilities',
      'Priority customer support'
    ],
    pricing: {
      external: { monthly: 15.99, yearly: 159.99 }
    },
    stripePriceIds: { 
      monthly: 'price_1RWQvhR96MkVj8srXAHJNEZy', 
      yearly: 'price_1RWQvhR96MkVj8srkeR7Ssad' 
    }
  },
  unlimited: {
    tier: 'unlimited',
    name: 'Enterprise Pro',
    description: 'Unlimited scanning for serious businesses',
    monthlyScans: -1,
    features: [
      'Unlimited scans',
      'All search types included',
      'Full 90 days sold data',
      'Real-time market intelligence',
      'Custom analytics reports',
      'Advanced search algorithms',
      'Dedicated account support',
      'API access (future)',
      'Priority processing'
    ],
    pricing: {
      external: { monthly: 29.99, yearly: 299.99 }
    },
    stripePriceIds: { 
      monthly: 'price_1RWQvqR96MkVj8srneZ54nI0', 
      yearly: 'price_1RWQvrR96MkVj8srF4Lm2WOv' 
    }
  }
};

export const SCAN_PACKS: ScanPack[] = [
  {
    id: 'pack_10',
    name: '10 Quick Scans',
    scanCount: 10,
    pricing: { external: 2.99 },
    stripePriceId: 'price_1RWQwCR96MkVj8srBq1EJCny'
  },
  {
    id: 'pack_30',
    name: '30 Scan Boost',
    scanCount: 30,
    pricing: { external: 7.99 },
    stripePriceId: 'price_1RWQwHR96MkVj8srQFpc8eNu'
  },
  {
    id: 'pack_75',
    name: '75 Scan Bundle',
    scanCount: 75,
    pricing: { external: 15.99 },
    stripePriceId: 'price_1RWQwQR96MkVj8srK6xuy1ih'
  }
];

export interface FeatureFlags {
  hasAdvancedSearch: boolean;
  canSaveSearches: boolean;
  maxSavedSearches: number;
  hasFullMarketData: boolean;
  soldDataDays: number;
  hasAnalytics: boolean;
  hasMarketTrends: boolean;
  hasPrioritySupport: boolean;
  showAds: boolean;
}

export function getFeatureFlags(tier: SubscriptionTier): FeatureFlags {
  switch (tier) {
    case 'free':
      return {
        hasAdvancedSearch: false,
        canSaveSearches: false,
        maxSavedSearches: 0,
        hasFullMarketData: false,
        soldDataDays: 90,
        hasAnalytics: false,
        hasMarketTrends: false,
        hasPrioritySupport: false,
        showAds: true
      };
    case 'hobby':
      return {
        hasAdvancedSearch: true,
        canSaveSearches: true,
        maxSavedSearches: 10,
        hasFullMarketData: true,
        soldDataDays: 90,
        hasAnalytics: false,
        hasMarketTrends: false,
        hasPrioritySupport: false,
        showAds: false
      };
    case 'pro':
      return {
        hasAdvancedSearch: true,
        canSaveSearches: true,
        maxSavedSearches: -1, // unlimited
        hasFullMarketData: true,
        soldDataDays: 90,
        hasAnalytics: true,
        hasMarketTrends: true,
        hasPrioritySupport: false,
        showAds: false
      };
    case 'business':
      return {
        hasAdvancedSearch: true,
        canSaveSearches: true,
        maxSavedSearches: -1,
        hasFullMarketData: true,
        soldDataDays: 90,
        hasAnalytics: true,
        hasMarketTrends: true,
        hasPrioritySupport: true,
        showAds: false
      };
    case 'unlimited':
      return {
        hasAdvancedSearch: true,
        canSaveSearches: true,
        maxSavedSearches: -1,
        hasFullMarketData: true,
        soldDataDays: 90,
        hasAnalytics: true,
        hasMarketTrends: true,
        hasPrioritySupport: true,
        showAds: false
      };
    default:
      return getFeatureFlags('free');
  }
} 