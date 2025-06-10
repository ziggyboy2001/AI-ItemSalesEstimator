# Environment Setup for BidPeek

This document outlines the environment variables needed for the subscription and payment system.

## Required Environment Variables

Create a `.env` file in your project root with the following variables:

```bash
# eBay API Configuration
EXPO_PUBLIC_EBAY_CLIENT_ID=your_ebay_client_id
EXPO_PUBLIC_EBAY_CLIENT_SECRET=your_ebay_client_secret

# eBay Affiliate Configuration
EXPO_PUBLIC_EBAY_PARTNER_ID=your_partner_id
EXPO_PUBLIC_EBAY_CAMPAIGN_ID=5339112507
EXPO_PUBLIC_EBAY_AFFILIATE_ENABLED=true

# Stripe Configuration
EXPO_PUBLIC_STRIPE_SERVER_URL=https://your-server.com/api
EXPO_PUBLIC_WEB_URL=https://bidpeek.app

# OpenAI Configuration
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key
```

## Setup Instructions

### 1. eBay Partner Network (Affiliate)

- Sign up at [eBay Partner Network](https://partnernetwork.ebay.com/)
- Get your Partner ID from the dashboard
- Campaign ID is already configured: `5339112507`

### 2. Stripe Setup

- Create a Stripe account
- Set up webhook endpoints for subscription events
- Configure your server URL for payment processing
- Create product and price IDs in Stripe dashboard

### 3. Web Server Required

You'll need a web server to handle:

- Stripe checkout session creation
- Webhook handling for subscription events
- Payment success/failure redirects back to the app

### 4. Deep Linking Setup

Configure deep links in your `app.json`:

```json
{
  "expo": {
    "scheme": "bidpeek",
    "web": {
      "bundler": "metro"
    }
  }
}
```

## Stripe Products to Create

In your Stripe dashboard, create these products and price IDs:

### Subscription Plans

- **Hobby Tier**:
  - Monthly: `price_hobby_monthly`
  - Yearly: `price_hobby_yearly`
- **Pro Tier**:
  - Monthly: `price_pro_monthly`
  - Yearly: `price_pro_yearly`
- **Business Tier**:
  - Monthly: `price_business_monthly`
  - Yearly: `price_business_yearly`

### Scan Packs

- **10 Scans**: `price_scan_pack_10`
- **25 Scans**: `price_scan_pack_25`
- **50 Scans**: `price_scan_pack_50`

## Testing

For testing, use Stripe's test mode and test card numbers.

## Security Notes

- Never expose Stripe secret keys in the client
- All payment processing should happen on your secure server
- Use HTTPS for all payment-related endpoints
