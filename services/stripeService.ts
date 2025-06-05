import { SubscriptionTier, PaymentMethod, ScanPack, SUBSCRIPTION_PLANS, SCAN_PACKS } from '@/types/subscription';
import { Linking } from 'react-native';

interface CreateCheckoutSessionParams {
  priceId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
  mode: 'subscription' | 'payment';
  metadata?: Record<string, string>;
}

interface StripeCheckoutSession {
  id: string;
  url: string;
  customer?: string;
}

class StripeService {
  private baseUrl: string;

  // Direct Stripe Payment Links (fallback when server unavailable)
  private paymentLinks = {
    subscriptions: {
      hobby: {
        monthly: 'https://buy.stripe.com/test_3cI6oJcos49F9Tg0Tq8bS00',
        yearly: 'https://buy.stripe.com/test_3cIdRbfAE5dJaXkau08bS01'
      },
      pro: {
        monthly: 'https://buy.stripe.com/test_5kQ14pagk5dJaXkgSo8bS02',
        yearly: 'https://buy.stripe.com/test_eVqaEZcoseOj2qOfOk8bS03'
      },
      business: {
        monthly: 'https://buy.stripe.com/test_5kQdRb74821x7L8dGc8bS04',
        yearly: 'https://buy.stripe.com/test_dRm3cx1JOgWr7L89pW8bS05'
      },
      unlimited: {
        monthly: 'https://buy.stripe.com/test_eVq7sN88c8pVd5sgSo8bS06',
        yearly: 'https://buy.stripe.com/test_aFabJ3gEI6hNd5s45C8bS07'
      }
    },
    scanPacks: {
      pack_10: 'https://buy.stripe.com/test_28E9AV2NS7lRd5s59G8bS08',
      pack_30: 'https://buy.stripe.com/test_eVqdRbdswgWr2qO45C8bS09',
      pack_75: 'https://buy.stripe.com/test_00w6oJ9cg9tZ8PccC88bS0a'
    }
  };

  constructor() {
    // Use the server we just created
    this.baseUrl = process.env.EXPO_PUBLIC_STRIPE_SERVER_URL || 'http://localhost:3000';
  }

  async createSubscriptionCheckout(
    tier: SubscriptionTier,
    billing: 'monthly' | 'yearly',
    userId: string,
    userEmail?: string
  ): Promise<StripeCheckoutSession> {
    const plan = SUBSCRIPTION_PLANS[tier];
    const priceId = plan.stripePriceIds[billing];

    if (!priceId) {
      throw new Error(`No Stripe price ID found for ${tier} ${billing}`);
    }

    const params: CreateCheckoutSessionParams = {
      priceId,
      userId,
      successUrl: `http://localhost:3000/success?tier=${tier}&billing=${billing}&userId=${userId}`,
      cancelUrl: `http://localhost:3000/cancel?userId=${userId}`,
      mode: 'subscription',
      metadata: {
        userId,
        tier,
        billing,
        paymentMethod: 'external'
      }
    };

    return this.createCheckoutSession(params, userEmail);
  }

  async createScanPackCheckout(
    packId: string,
    userId: string,
    userEmail?: string
  ): Promise<StripeCheckoutSession> {
    const pack = SCAN_PACKS.find(p => p.id === packId);
    
    if (!pack) {
      throw new Error(`Scan pack not found: ${packId}`);
    }

    const params: CreateCheckoutSessionParams = {
      priceId: pack.stripePriceId,
      userId,
      successUrl: `http://localhost:3000/success?packId=${packId}&userId=${userId}`,
      cancelUrl: `http://localhost:3000/cancel?userId=${userId}`,
      mode: 'payment',
      metadata: {
        userId,
        packId,
        scanCount: pack.scanCount.toString(),
        paymentMethod: 'external'
      }
    };

    return this.createCheckoutSession(params, userEmail);
  }

  private async createCheckoutSession(
    params: CreateCheckoutSessionParams,
    userEmail?: string
  ): Promise<StripeCheckoutSession> {
    try {
      console.log('🔄 Creating checkout session via server...');
      
      const response = await fetch(`${this.baseUrl}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...params,
          customerEmail: userEmail,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Stripe checkout creation failed: ${errorText}`);
      }

      const session = await response.json();
      
      console.log('✅ Stripe checkout session created:', session.id);
      return session;
    } catch (error) {
      console.error('❌ Failed to create Stripe checkout session:', error);
      throw error;
    }
  }

  // New method to directly open Stripe checkout
  async openCheckoutSession(
    tier: SubscriptionTier,
    billing: 'monthly' | 'yearly',
    userId: string,
    userEmail?: string
  ): Promise<void> {
    try {
      const session = await this.createSubscriptionCheckout(tier, billing, userId, userEmail);
      
      console.log('🔗 Opening Stripe checkout URL:', session.url);
      
      const supported = await Linking.canOpenURL(session.url);
      if (supported) {
        await Linking.openURL(session.url);
      } else {
        throw new Error('Cannot open Stripe checkout on this device');
      }
    } catch (error) {
      console.error('❌ Failed to open checkout:', error);
      throw error;
    }
  }

  async openScanPackCheckout(
    packId: string,
    userId: string,
    userEmail?: string
  ): Promise<void> {
    try {
      const session = await this.createScanPackCheckout(packId, userId, userEmail);
      
      console.log('🔗 Opening scan pack checkout URL:', session.url);
      
      const supported = await Linking.canOpenURL(session.url);
      if (supported) {
        await Linking.openURL(session.url);
      } else {
        throw new Error('Cannot open Stripe checkout on this device');
      }
    } catch (error) {
      console.error('❌ Failed to open scan pack checkout:', error);
      throw error;
    }
  }

  async cancelSubscription(stripeSubscriptionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/stripe/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: stripeSubscriptionId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Subscription cancellation failed: ${errorText}`);
      }

      console.log('✅ Subscription cancelled:', stripeSubscriptionId);
    } catch (error) {
      console.error('❌ Failed to cancel subscription:', error);
      throw error;
    }
  }

  async getSubscriptionStatus(stripeSubscriptionId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/stripe/subscription-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: stripeSubscriptionId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get subscription status: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get subscription status:', error);
      throw error;
    }
  }

  // Helper method to get pricing comparison
  getPricingComparison(tier: SubscriptionTier, billing: 'monthly' | 'yearly') {
    const plan = SUBSCRIPTION_PLANS[tier];
    const externalPrice = plan.pricing.external[billing];

    return {
      externalPrice
    };
  }

  // Generate the external payment URL for deep linking (fallback)
  generatePaymentUrl(tier: SubscriptionTier, billing: 'monthly' | 'yearly', userId: string): string {
    // Use direct Stripe payment link for immediate checkout
    if (tier !== 'free' && tier in this.paymentLinks.subscriptions) {
      const subscriptionTier = tier as keyof typeof this.paymentLinks.subscriptions;
      return this.paymentLinks.subscriptions[subscriptionTier][billing];
    }
    
    // Fallback to server-based URL
    const baseUrl = process.env.EXPO_PUBLIC_WEB_URL || this.baseUrl;
    return `${baseUrl}/subscribe?tier=${tier}&billing=${billing}&userId=${userId}&source=app`;
  }

  // Generate scan pack payment URL
  generateScanPackUrl(packId: string, userId: string): string {
    // Use direct Stripe payment link for immediate checkout  
    if (packId in this.paymentLinks.scanPacks) {
      const scanPackId = packId as keyof typeof this.paymentLinks.scanPacks;
      return this.paymentLinks.scanPacks[scanPackId];
    }
    
    // Fallback to server-based URL
    const baseUrl = process.env.EXPO_PUBLIC_WEB_URL || this.baseUrl;
    return `${baseUrl}/buy-scans?packId=${packId}&userId=${userId}`;
  }

  // Check if server is available
  async checkServerHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        timeout: 5000, // 5 second timeout
      } as any);
      
      return response.ok;
    } catch (error) {
      console.warn('⚠️ Payment server not available:', error);
      return false;
    }
  }
}

export const stripeService = new StripeService();

// Pricing display helpers
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function calculateYearlySavings(tier: SubscriptionTier, paymentMethod: PaymentMethod): number {
  const plan = SUBSCRIPTION_PLANS[tier];
  const monthlyPrice = plan.pricing[paymentMethod].monthly;
  const yearlyPrice = plan.pricing[paymentMethod].yearly;
  
  return (monthlyPrice * 12) - yearlyPrice;
}

export function getRecommendedPaymentMethod(): PaymentMethod {
  // Always recommend external to avoid Apple's 30% fee
  return 'external';
}

// Scan usage helpers
export function canPerformScan(scansUsed: number, scansLimit: number): boolean {
  return scansUsed < scansLimit;
}

export function getScanPackRecommendation(scansNeeded: number): ScanPack | null {
  const sortedPacks = [...SCAN_PACKS].sort((a, b) => a.scanCount - b.scanCount);
  return sortedPacks.find(pack => pack.scanCount >= scansNeeded) || sortedPacks[sortedPacks.length - 1];
} 