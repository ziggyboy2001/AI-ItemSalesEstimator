const express = require('express');
const cors = require('cors');
const stripe = require('stripe');
require('dotenv').config();

// Supabase setup for webhook database updates
const SUPABASE_URL = 'https://sxkrkcxumaphascahdxz.supabase.co';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4a3JrY3h1bWFwaGFzY2FoZHh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Nzc1MzU5NCwiZXhwIjoyMDYzMzI5NTk0fQ.xGdZFUsE832h4teWSsMfBZTvDn3GqmjRORkvTaFS99o';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Stripe with secret key
const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(cors());

// 🎯 WEBHOOK ROUTE FIRST - BEFORE express.json()
app.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      event = stripeClient.webhooks.constructEvent(
        req.body,
        sig,
        endpointSecret
      );
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`\n🎯 ===== WEBHOOK EVENT DEBUG =====`);
    console.log(`📨 Event Type: ${event.type}`);
    console.log(`🆔 Event ID: ${event.id}`);
    console.log(`📅 Created: ${new Date(event.created * 1000).toISOString()}`);
    
    if (event.data.object.metadata) {
      console.log(`📋 Metadata:`, event.data.object.metadata);
    } else {
      console.log(`⚠️ NO METADATA FOUND`);
    }
    
    console.log(`🔍 Object ID: ${event.data.object.id}`);
    console.log(`=====================================\n`);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        console.log(`🛒 Processing checkout.session.completed...`);
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
        console.log(`📋 Processing customer.subscription.created...`);
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        console.log(`🔄 Processing customer.subscription.updated...`);
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        console.log(`❌ Processing customer.subscription.deleted...`);
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        console.log(`💰 Processing invoice.payment_succeeded...`);
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        console.log(`💸 Processing invoice.payment_failed...`);
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log(`🤷 Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  }
);

// JSON middleware AFTER webhook route
app.use(express.json());

// Serve static files from oauth-pages directory
const path = require('path');
app.use(express.static(path.join(__dirname, '../oauth-pages')));

// Specific routes for payment callbacks
app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, '../oauth-pages/success.html'));
});

app.get('/cancel', (req, res) => {
  res.sendFile(path.join(__dirname, '../oauth-pages/cancel.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Record scan endpoint for app
app.post('/record-scan', async (req, res) => {
  try {
    const { userId, deviceId, scanType, searchId, metadata } = req.body;

    console.log(
      `📝 Recording scan via API: ${scanType} for device ${deviceId}`
    );

    const response = await fetch(`${SUPABASE_URL}/rest/v1/user_scans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        device_id: deviceId,
        scan_type: scanType,
        search_id: searchId || null,
        metadata: metadata || null,
        created_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to record scan: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    console.log(`✅ Scan recorded successfully via API: ${scanType}`);
    res.json({ success: true, message: 'Scan recorded successfully' });
  } catch (error) {
    console.error('❌ Error recording scan via API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get comprehensive subscription status (subscription + usage + totals)
app.get('/subscription-status/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { userId } = req.query;

    console.log(`📋 Getting complete subscription status for device ${deviceId}`);

    // Get subscription
    const queryParam = userId
      ? `user_id=eq.${userId}`
      : `device_id=eq.${deviceId}&user_id=is.null`;

    const subResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/user_subscriptions?${queryParam}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!subResponse.ok) {
      throw new Error(`Failed to fetch subscription: ${subResponse.statusText}`);
    }

    const subscriptions = await subResponse.json();
    let subscription;

    if (subscriptions.length === 0) {
      subscription = await createFreeSubscription(userId, deviceId);
    } else {
      subscription = subscriptions[0];
    }

    // Get current month usage
    const usageResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/user_scans?${userId ? `user_id=eq.${userId}` : `device_id=eq.${deviceId}`}&created_at=gte.${new Date().getFullYear()}-${String(
        new Date().getMonth() + 1
      ).padStart(2, '0')}-01T00:00:00Z`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!usageResponse.ok) {
      throw new Error(`Failed to fetch usage: ${usageResponse.statusText}`);
    }

    const scans = await usageResponse.json();
    const breakdown = {
      current_text: 0,
      current_image: 0,
      sold_text: 0,
    };

    scans.forEach((scan) => {
      if (scan.scan_type in breakdown) {
        breakdown[scan.scan_type]++;
      }
    });

    const totalUsage = Object.values(breakdown).reduce((sum, count) => sum + count, 0);

    // Get bonus scans from scan credits
    let bonusScans = 0;
    try {
      const creditsResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/scan_credits?device_id=eq.${deviceId}&select=scan_credits`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (creditsResponse.ok) {
        const credits = await creditsResponse.json();
        bonusScans = credits.reduce((sum, credit) => sum + credit.scan_credits, 0);
        console.log(`📊 Bonus scans from credits for device ${deviceId}: ${bonusScans}`);
      }
    } catch (creditsError) {
      console.warn('Failed to fetch scan credits:', creditsError.message);
    }

    // Calculate totals
    const scanLimits = {
      free: 3,
      hobby: 25,
      pro: 100,
      business: 100,
      unlimited: -1,
    };

    const baseLimit = scanLimits[subscription.subscription_type] || 3;
    const totalLimit = baseLimit === -1 ? -1 : baseLimit + bonusScans;
    const remaining = totalLimit === -1 ? -1 : Math.max(0, totalLimit - totalUsage);

    // Return comprehensive status
    res.json({
      subscription,
      usage: {
        used: totalUsage,
        breakdown,
        month: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'),
      },
      scans: {
        baseLimit,
        bonusScans,
        totalLimit,
        used: totalUsage,
        remaining,
      },
      canScan: subscription.subscription_type === 'unlimited' || totalUsage < totalLimit,
    });

  } catch (error) {
    console.error('❌ Error getting subscription status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user subscription endpoint (legacy - kept for backward compatibility)
app.get('/subscription/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { userId } = req.query;

    console.log(`📋 Getting subscription for device ${deviceId}`);

    const queryParam = userId
      ? `user_id=eq.${userId}`
      : `device_id=eq.${deviceId}&user_id=is.null`;

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/user_subscriptions?${queryParam}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch subscription: ${response.statusText}`);
    }

    const subscriptions = await response.json();

    if (subscriptions.length === 0) {
      // Create free subscription
      const freeSubscription = await createFreeSubscription(userId, deviceId);
      res.json(freeSubscription);
    } else {
      res.json(subscriptions[0]);
    }
  } catch (error) {
    console.error('❌ Error getting subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get usage info endpoint
app.get('/usage/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { userId } = req.query;

    console.log(`📊 Getting usage for device ${deviceId}`);

    const queryParam = userId
      ? `user_id=eq.${userId}`
      : `device_id=eq.${deviceId}`;

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/user_scans?${queryParam}&created_at=gte.${new Date().getFullYear()}-${String(
        new Date().getMonth() + 1
      ).padStart(2, '0')}-01T00:00:00Z`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch usage: ${response.statusText}`);
    }

    const scans = await response.json();

    const breakdown = {
      current_text: 0,
      current_image: 0,
      sold_text: 0,
    };

    scans.forEach((scan) => {
      if (scan.scan_type in breakdown) {
        breakdown[scan.scan_type]++;
      }
    });

    const totalUsage = Object.values(breakdown).reduce(
      (sum, count) => sum + count,
      0
    );

    res.json({
      used: totalUsage,
      breakdown,
      month:
        new Date().getFullYear() +
        '-' +
        String(new Date().getMonth() + 1).padStart(2, '0'),
    });
  } catch (error) {
    console.error('❌ Error getting usage:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check scan limits endpoint
app.post('/check-scan-limit', async (req, res) => {
  try {
    const { userId, deviceId, scanType } = req.body;

    console.log(`🔍 Checking scan limit for ${scanType} on device ${deviceId}`);

    // Get subscription
    const subResponse = await fetch(
      `http://localhost:${PORT}/subscription/${deviceId}${
        userId ? `?userId=${userId}` : ''
      }`,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!subResponse.ok) {
      throw new Error('Failed to get subscription');
    }

    const subscription = await subResponse.json();

    // Get usage
    const usageResponse = await fetch(
      `http://localhost:${PORT}/usage/${deviceId}${
        userId ? `?userId=${userId}` : ''
      }`,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!usageResponse.ok) {
      throw new Error('Failed to get usage');
    }

    const usage = await usageResponse.json();

    // Get bonus scans from scan credits
    let bonusScans = 0;
    try {
      const creditsResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/scan_credits?device_id=eq.${deviceId}&select=scan_credits`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (creditsResponse.ok) {
        const credits = await creditsResponse.json();
        bonusScans = credits.reduce((sum, credit) => sum + credit.scan_credits, 0);
        console.log(`📊 Bonus scans from credits for device ${deviceId}: ${bonusScans}`);
      }
    } catch (creditsError) {
      console.warn('Failed to fetch scan credits:', creditsError.message);
    }

    // Check limits
    const scanLimits = {
      free: 3,
      hobby: 25,
      pro: 100,
      business: 100,
      unlimited: -1,
    };

    const baseLimit = scanLimits[subscription.subscription_type] || 3;
    const totalLimit = baseLimit === -1 ? -1 : baseLimit + bonusScans;
    
    const canScan =
      subscription.subscription_type === 'unlimited' || usage.used < totalLimit;

    res.json({
      canScan,
      usageInfo: {
        used: usage.used,
        limit: totalLimit,
        remaining: totalLimit === -1 ? -1 : Math.max(0, totalLimit - usage.used),
        breakdown: usage.breakdown,
      },
      reason: !canScan
        ? `You've reached your ${subscription.subscription_type} plan limit of ${totalLimit} scans this month (${baseLimit} base + ${bonusScans} bonus). Upgrade to continue scanning.`
        : undefined,
    });
  } catch (error) {
    console.error('❌ Error checking scan limit:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to manually update subscription (for debugging)
app.post('/test/update-subscription', async (req, res) => {
  try {
    const { userId, tier, billing, stripeSubscriptionId, stripeCustomerId } =
      req.body;

    await updateUserSubscription(userId, {
      tier,
      billing,
      stripeSubscriptionId,
      stripeCustomerId,
      status: 'active',
    });

    res.json({ success: true, message: 'Subscription updated successfully' });
  } catch (error) {
    console.error('Test update failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check environment variables
app.get('/debug/env', (req, res) => {
  res.json({
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY: SUPABASE_SERVICE_KEY
      ? SUPABASE_SERVICE_KEY.substring(0, 20) + '...'
      : 'NOT SET',
    env_SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY
      ? process.env.SUPABASE_SERVICE_KEY.substring(0, 20) + '...'
      : 'NOT SET',
    PORT: PORT,
    NODE_ENV: process.env.NODE_ENV,
  });
});

// Create Stripe checkout session
app.post('/stripe/create-checkout-session', async (req, res) => {
  try {
    const {
      priceId,
      userId,
      successUrl,
      cancelUrl,
      mode,
      metadata,
      customerEmail,
    } = req.body;

    console.log(`🔄 Creating ${mode} checkout session for user ${userId}`);

    // Create checkout session
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: mode, // 'subscription' or 'payment'
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: customerEmail,
      metadata: metadata || {},
      success_url: successUrl,
      cancel_url: cancelUrl,
      // For subscriptions, collect billing address
      ...(mode === 'subscription' && {
        billing_address_collection: 'auto',
      }),
    });

    console.log(`✅ Checkout session created: ${session.id}`);

    res.json({
      id: session.id,
      url: session.url,
      customer: session.customer,
    });
  } catch (error) {
    console.error('❌ Error creating checkout session:', error);
    res.status(500).json({
      error: error.message,
      type: 'stripe_error',
    });
  }
});

// Cancel subscription
app.post('/stripe/cancel-subscription', async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    const subscription = await stripeClient.subscriptions.update(
      subscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    console.log(
      `✅ Subscription ${subscriptionId} set to cancel at period end`
    );

    res.json({
      id: subscription.id,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_end: subscription.current_period_end,
    });
  } catch (error) {
    console.error('❌ Error cancelling subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get subscription status
app.post('/stripe/subscription-status', async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    const subscription = await stripeClient.subscriptions.retrieve(
      subscriptionId
    );

    res.json({
      id: subscription.id,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at,
    });
  } catch (error) {
    console.error('❌ Error getting subscription status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Success page - redirects back to app
app.get('/success', (req, res) => {
  const { tier, billing, packId, userId } = req.query;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>BidPeek - Payment Successful!</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 400px; 
          margin: 50px auto; 
          padding: 20px;
          text-align: center;
          background: #f8f9fa;
        }
        .success-icon { font-size: 64px; margin-bottom: 20px; }
        .title { font-size: 24px; font-weight: bold; color: #28a745; margin-bottom: 20px; }
        .message { font-size: 16px; color: #333; margin-bottom: 30px; line-height: 1.5; }
        .btn { 
          background: #007AFF; 
          color: white; 
          padding: 15px 30px; 
          border: none; 
          border-radius: 8px; 
          font-size: 16px; 
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
        }
        .btn:hover { background: #0056CC; }
      </style>
    </head>
    <body>
      <div class="success-icon">✅</div>
      <div class="title">Payment Successful!</div>
      <div class="message">
        ${
          tier
            ? `Your ${tier} subscription has been activated.`
            : `Your scan pack has been added to your account.`
        }
        <br><br>
        You can now return to the BidPeek app to start using your new features.
      </div>
      <a href="bidpeek://subscription/success?tier=${tier || ''}&billing=${billing || ''}" class="btn">Return to App</a>
      
      <script>
        // Auto-redirect after 2 seconds
        setTimeout(() => {
          window.location.href = 'bidpeek://subscription/success?tier=${tier || ''}&billing=${billing || ''}';
        }, 2000);
      </script>
    </body>
    </html>
  `);
});

// Cancel page - redirects back to app
app.get('/cancel', (req, res) => {
  const { userId } = req.query;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>BidPeek - Payment Cancelled</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 400px; 
          margin: 50px auto; 
          padding: 20px;
          text-align: center;
          background: #f8f9fa;
        }
        .cancel-icon { font-size: 64px; margin-bottom: 20px; }
        .title { font-size: 24px; font-weight: bold; color: #6c757d; margin-bottom: 20px; }
        .message { font-size: 16px; color: #333; margin-bottom: 30px; line-height: 1.5; }
        .btn { 
          background: #007AFF; 
          color: white; 
          padding: 15px 30px; 
          border: none; 
          border-radius: 8px; 
          font-size: 16px; 
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
        }
        .btn:hover { background: #0056CC; }
      </style>
    </head>
    <body>
      <div class="cancel-icon">❌</div>
      <div class="title">Payment Cancelled</div>
      <div class="message">
        No worries! You can try again anytime or continue using BidPeek with your current plan.
      </div>
      <a href="bidpeek://subscription/cancel" class="btn">Return to App</a>
      
      <script>
        // Auto-redirect after 3 seconds
        setTimeout(() => {
          window.location.href = 'bidpeek://subscription/cancel';
        }, 3000);
      </script>
    </body>
    </html>
  `);
});

// Web pages for subscription flow
app.get('/subscribe', (req, res) => {
  const { tier, billing, userId, source } = req.query;

  // Simple HTML page that redirects to mobile app or shows subscription form
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>BidPeek - Subscribe to ${tier}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 400px; 
          margin: 50px auto; 
          padding: 20px;
          text-align: center;
        }
        .logo { font-size: 24px; font-weight: bold; color: #007AFF; margin-bottom: 20px; }
        .plan-info { background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 20px 0; }
        .price { font-size: 32px; font-weight: bold; color: #007AFF; }
        .features { text-align: left; margin: 15px 0; }
        .feature { margin: 5px 0; }
        .btn { 
          background: #007AFF; 
          color: white; 
          padding: 15px 30px; 
          border: none; 
          border-radius: 8px; 
          font-size: 16px; 
          cursor: pointer;
          width: 100%;
          margin: 10px 0;
        }
        .btn:hover { background: #0056CC; }
        .back-link { color: #007AFF; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="logo">🔍 BidPeek</div>
      <h1>Subscribe to ${tier.charAt(0).toUpperCase() + tier.slice(1)}</h1>
      
      <div class="plan-info">
        <div class="price">Save 20%!</div>
        <p>By subscribing here instead of through the App Store</p>
      </div>

      <button class="btn" onclick="startCheckout()">
        Start ${billing.charAt(0).toUpperCase() + billing.slice(1)} Subscription
      </button>
      
      <p><a href="bidpeek://subscription/cancel" class="back-link">← Back to App</a></p>
      
      <script>
        async function startCheckout() {
          try {
            // This would call your checkout creation endpoint
            // For now, just redirect back to app
            window.location.href = 'bidpeek://subscription/success?tier=${tier}&billing=${billing}';
          } catch (error) {
            alert('Error starting checkout: ' + error.message);
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Webhook handlers
async function handleCheckoutCompleted(session) {
  console.log(`💳 Payment completed for session: ${session.id}`);

  const { userId, tier, billing, packId, scanCount } = session.metadata || {};

  if (tier && billing) {
    // Subscription purchase
    console.log(`✅ New subscription: ${tier} ${billing} for user ${userId}`);
    await updateUserSubscription(userId, {
      tier,
      billing,
      stripeSubscriptionId: session.subscription,
      stripeCustomerId: session.customer,
      status: 'active',
    });
  } else if (packId && scanCount) {
    // Scan pack purchase
    console.log(
      `✅ Scan pack purchased: ${scanCount} scans for user ${userId}`
    );
    await addScansToUser(userId, parseInt(scanCount));
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log(`🆕 Subscription created: ${subscription.id}`);

  // Extract user ID from subscription metadata
  const userId =
    subscription.metadata?.userId || subscription.metadata?.user_id;

  if (userId) {
    await updateUserSubscription(userId, {
      tier: subscription.metadata?.tier || 'hobby',
      billing: subscription.metadata?.billing || 'monthly',
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      status: subscription.status,
    });
  } else {
    console.warn(
      `⚠️ No user ID found in subscription metadata: ${subscription.id}`
    );
  }
}

async function handleSubscriptionUpdated(subscription) {
  console.log(`🔄 Subscription updated: ${subscription.id}`);

  // Find user by Stripe subscription ID
  const userId = await findUserByStripeSubscriptionId(subscription.id);

  if (userId) {
    await updateUserSubscription(userId, {
      tier: subscription.metadata?.tier || 'hobby',
      billing: subscription.metadata?.billing || 'monthly',
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      status: subscription.status,
    });
  } else {
    console.warn(`⚠️ No user found for subscription: ${subscription.id}`);
  }
}

async function handleSubscriptionDeleted(subscription) {
  console.log(`❌ Subscription deleted: ${subscription.id}`);

  // Find user by Stripe subscription ID and downgrade to free
  const userId = await findUserByStripeSubscriptionId(subscription.id);

  if (userId) {
    await updateUserSubscription(userId, {
      tier: 'free',
      billing: 'monthly',
      stripeSubscriptionId: null,
      stripeCustomerId: subscription.customer,
      status: 'canceled',
    });
  } else {
    console.warn(
      `⚠️ No user found for canceled subscription: ${subscription.id}`
    );
  }
}

async function handleInvoicePaymentSucceeded(invoice) {
  console.log(`💰 Payment succeeded for invoice: ${invoice.id}`);

  if (invoice.subscription) {
    // Find user and ensure subscription is active
    const userId = await findUserByStripeSubscriptionId(invoice.subscription);

    if (userId) {
      // Reset monthly usage for the new billing period
      await resetMonthlyUsageForUser(userId);
      console.log(`✅ Reset monthly usage for user ${userId}`);
    }
  }
}

async function handleInvoicePaymentFailed(invoice) {
  console.log(`💸 Payment failed for invoice: ${invoice.id}`);

  if (invoice.subscription) {
    // Find user and mark subscription as past_due
    const userId = await findUserByStripeSubscriptionId(invoice.subscription);

    if (userId) {
      await updateUserSubscription(userId, {
        status: 'past_due',
      });
      console.log(`⚠️ Marked subscription as past_due for user ${userId}`);
    }
  }
}

// Helper function to find user by Stripe subscription ID
async function findUserByStripeSubscriptionId(stripeSubscriptionId) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/user_subscriptions?stripe_subscription_id=eq.${stripeSubscriptionId}&select=device_id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const subscriptions = await response.json();
    return subscriptions.length > 0 ? subscriptions[0].device_id : null;
  } catch (error) {
    console.error(
      `❌ Error finding user for subscription ${stripeSubscriptionId}:`,
      error
    );
    return null;
  }
}

// Helper function to reset monthly usage for a user
async function resetMonthlyUsageForUser(userId) {
  try {
    // Note: We don't actually delete scan records, they serve as historical data
    // The SubscriptionService handles monthly usage calculation based on date ranges
    console.log(
      `🔄 Monthly usage reset triggered for user ${userId} (handled by date-based calculation)`
    );
  } catch (error) {
    console.error(
      `❌ Error resetting monthly usage for user ${userId}:`,
      error
    );
  }
}

// Helper function to create free subscription
async function createFreeSubscription(userId, deviceId) {
  try {
    const now = new Date();
    const nextMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate()
    );

    const subscriptionRecord = {
      user_id: userId,
      device_id: deviceId,
      subscription_type: 'free',
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: nextMonth.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/user_subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(subscriptionRecord),
    });

    if (!response.ok) {
      throw new Error(`Failed to create subscription: ${response.statusText}`);
    }

    const created = await response.json();
    console.log('✅ Created free subscription for device:', deviceId);
    return created[0];
  } catch (error) {
    console.error('Error creating free subscription:', error);
    // Return a default object if database fails
    return {
      user_id: userId,
      device_id: deviceId,
      subscription_type: 'free',
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    };
  }
}

// Database helpers - Supabase integration
async function updateUserSubscription(userId, subscriptionData) {
  try {
    console.log(
      `📝 Updating subscription for user ${userId}:`,
      subscriptionData
    );

    const now = new Date().toISOString();
    const nextMonth = new Date();
    nextMonth.setMonth(
      nextMonth.getMonth() + (subscriptionData.billing === 'yearly' ? 12 : 1)
    );

    // First, check if user subscription exists (check by device_id since that's what we're using)
    const checkResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/user_subscriptions?device_id=eq.${userId}`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const existingSubscriptions = await checkResponse.json();

    const subscriptionRecord = {
      device_id: userId,
      subscription_type: subscriptionData.tier,
      status: subscriptionData.status,
      current_period_start: now,
      current_period_end: nextMonth.toISOString(),
      stripe_subscription_id: subscriptionData.stripeSubscriptionId,
      stripe_customer_id: subscriptionData.stripeCustomerId || null,
      updated_at: now,
    };

    if (existingSubscriptions.length > 0) {
      // Update existing subscription
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/user_subscriptions?device_id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(subscriptionRecord),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to update subscription: ${response.statusText}`
        );
      }

      console.log(
        `✅ Updated subscription for user ${userId} to ${subscriptionData.tier}`
      );
    } else {
      // Create new subscription
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/user_subscriptions`,
        {
          method: 'POST',
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...subscriptionRecord,
            created_at: now,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to create subscription: ${response.statusText}`
        );
      }

      console.log(
        `✅ Created new subscription for user ${userId}: ${subscriptionData.tier}`
      );
    }
  } catch (error) {
    console.error(`❌ Error updating subscription for user ${userId}:`, error);
    throw error;
  }
}

async function addScansToUser(userId, scanCount) {
  try {
    console.log(`📝 Adding ${scanCount} scans to user ${userId}`);

    const now = new Date().toISOString();

    // Record the scan pack purchase as credits in a separate table
    const creditRecord = {
      device_id: userId,
      scan_credits: scanCount,
      purchase_date: now,
      stripe_source: 'scan_pack_purchase',
      expires_at: null, // Scan credits don't expire
      created_at: now,
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/scan_credits`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(creditRecord),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase error response:', errorText);
      throw new Error(`Failed to record scan credits: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ Added ${scanCount} scan credits for user ${userId}`, result);
  } catch (error) {
    console.error(`❌ Error adding scans for user ${userId}:`, error);
    throw error;
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message:
      process.env.NODE_ENV === 'development'
        ? error.message
        : 'Something went wrong',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Payment server running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Subscribe URL: http://localhost:${PORT}/subscribe`);
});
