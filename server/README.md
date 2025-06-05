# BidPeek Payment Server

Express.js server that handles Stripe payments and subscriptions for the BidPeek mobile app.

## 🚀 Quick Start

1. **Install dependencies:**

   ```bash
   cd server
   npm install
   ```

2. **Create environment file:**

   ```bash
   # Create .env file in server directory
   touch .env
   ```

3. **Add environment variables:**

   ```bash
   # Stripe Configuration
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # App Configuration
   APP_URL=bidpeek://
   WEB_URL=https://your-domain.com
   ```

4. **Start the server:**
   ```bash
   npm run dev
   ```

## 📡 API Endpoints

### Health Check

- `GET /health` - Server health status

### Stripe Integration

- `POST /stripe/create-checkout-session` - Create payment session
- `POST /stripe/webhook` - Handle Stripe webhooks
- `POST /stripe/cancel-subscription` - Cancel subscription
- `POST /stripe/subscription-status` - Get subscription status

### Web Pages

- `GET /subscribe` - Subscription landing page

## 🔧 Setup Instructions

### 1. Stripe Dashboard Setup

1. Create products and prices in Stripe dashboard:

   - **Hobby Monthly**: `price_hobby_monthly`
   - **Hobby Yearly**: `price_hobby_yearly`
   - **Pro Monthly**: `price_pro_monthly`
   - **Pro Yearly**: `price_pro_yearly`
   - **Business Monthly**: `price_business_monthly`
   - **Business Yearly**: `price_business_yearly`
   - **10 Scan Pack**: `price_scan_pack_10`
   - **25 Scan Pack**: `price_scan_pack_25`
   - **50 Scan Pack**: `price_scan_pack_50`

2. Set up webhook endpoint:
   - URL: `https://your-domain.com/stripe/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

### 2. Mobile App Configuration

Update your mobile app's environment variables:

```bash
EXPO_PUBLIC_STRIPE_SERVER_URL=https://your-domain.com
EXPO_PUBLIC_WEB_URL=https://your-domain.com
```

## 🔄 Development Workflow

1. **Run both mobile app and server:**

   ```bash
   # Terminal 1: Mobile app (from root directory)
   npm start

   # Terminal 2: Server
   cd server && npm run dev
   ```

2. **Test payments:**
   - Use Stripe test cards: `4242 4242 4242 4242`
   - Monitor webhook events in Stripe dashboard
   - Check server logs for payment processing

## 🚀 Deployment

### Option 1: Railway

```bash
# Connect to Railway
railway login
railway init
railway add
```

### Option 2: Render

1. Connect GitHub repo
2. Set environment variables
3. Deploy from dashboard

### Option 3: Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## 📊 Monitoring

- Check `/health` endpoint for server status
- Monitor Stripe dashboard for payment events
- Review server logs for errors

## 🔒 Security Notes

- Never commit `.env` files
- Use HTTPS in production
- Validate webhook signatures
- Implement rate limiting for production
