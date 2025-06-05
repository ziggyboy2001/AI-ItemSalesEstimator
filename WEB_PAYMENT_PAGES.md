# Web Payment Pages for BidPeek

## 🌐 **Required Web Pages**

You need to create these pages on your website (e.g., `https://bidpeek.com`) for fallback scenarios:

### 1. **Subscription Payment Page**

**URL**: `https://bidpeek.com/subscribe`

**Query Parameters**:

- `tier`: hobby, pro, business, unlimited
- `billing`: monthly, yearly
- `userId`: user identifier
- `source`: app (to track source)

**Example URLs**:

```
https://bidpeek.com/subscribe?tier=pro&billing=monthly&userId=user123&source=app
https://bidpeek.com/subscribe?tier=unlimited&billing=yearly&userId=user456&source=app
```

### 2. **Scan Pack Purchase Page**

**URL**: `https://bidpeek.com/buy-scans`

**Query Parameters**:

- `packId`: pack_10, pack_30, pack_75
- `userId`: user identifier

**Example URLs**:

```
https://bidpeek.com/buy-scans?packId=pack_10&userId=user123
https://bidpeek.com/buy-scans?packId=pack_75&userId=user456
```

### 3. **Payment Success Page**

**URL**: `https://bidpeek.com/payment/success`

Shows confirmation and redirects back to app.

### 4. **Payment Cancel Page**

**URL**: `https://bidpeek.com/payment/cancel`

Shows cancellation message and option to retry.

## 📝 **Sample Payment Page Implementation**

### Subscription Page (`/subscribe`)

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Complete Your BidPeek Subscription</title>
    <script src="https://js.stripe.com/v3/"></script>
  </head>
  <body>
    <div class="container">
      <h1>Complete Your Subscription</h1>
      <div id="subscription-details"></div>
      <button id="checkout-button">Pay Now & Save 20%</button>
    </div>

    <script>
      const stripe = Stripe('pk_test_YOUR_PUBLISHABLE_KEY');

      // Get URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const tier = urlParams.get('tier');
      const billing = urlParams.get('billing');
      const userId = urlParams.get('userId');

      // Create checkout session and redirect
      document
        .getElementById('checkout-button')
        .addEventListener('click', async () => {
          const response = await fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tier, billing, userId }),
          });

          const session = await response.json();
          await stripe.redirectToCheckout({ sessionId: session.id });
        });
    </script>
  </body>
</html>
```

## 🔧 **Quick Setup Options**

### Option 1: **Use Stripe Payment Links** (Easiest)

Create direct payment links in your Stripe dashboard for each product:

1. Go to Stripe Dashboard → Payment Links
2. Create links for each subscription tier
3. Use these URLs directly in your app

### Option 2: **Use Your Payment Server** (Recommended)

Your existing server at `localhost:3000` can serve these pages:

```javascript
// Add to your server/server.js
app.get('/subscribe', (req, res) => {
  const { tier, billing, userId } = req.query;
  // Render subscription page or redirect to Stripe
  res.redirect('/create-checkout-session?tier=' + tier + '&billing=' + billing);
});
```

### Option 3: **Simple Static Pages** (Fast)

Host simple HTML pages that just redirect to Stripe Checkout.

## 🚀 **Immediate Solution**

For now, you can update your app to use Stripe Payment Links directly. Let me create them for you:
