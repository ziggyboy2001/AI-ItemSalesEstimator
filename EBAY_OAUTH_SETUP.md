# eBay OAuth Setup with HTTPS Redirect Pages

This guide explains how to configure eBay OAuth to work with the BidPeek app using HTTPS redirect pages.

## Setup Steps

### 1. Host the OAuth Redirect Pages

You need to host the HTML files in the `oauth-pages/` folder on a web server with HTTPS. Here are your options:

#### Option A: Use Netlify (Recommended for Testing)

1. Go to [Netlify](https://netlify.com) and create a free account
2. Drag and drop the `oauth-pages` folder to create a new site
3. Note your site URL (e.g., `https://your-site-name.netlify.app`)

#### Option B: Use Your Own Domain

1. Upload `oauth-pages/ebay-success.html` to `https://yourdomain.com/oauth/ebay-success`
2. Upload `oauth-pages/ebay-declined.html` to `https://yourdomain.com/oauth/ebay-declined`

#### Option C: Use GitHub Pages

1. Create a new GitHub repository
2. Upload the HTML files
3. Enable GitHub Pages in repository settings

### 2. Update Configuration

Update the redirect URIs in your code to match your hosted URLs:

```typescript
// In services/ebayApi.ts
export const EBAY_LISTING_CONFIG = {
  production: {
    redirectUri: 'https://yourdomain.com/oauth/ebay-success',
  },
  sandbox: {
    redirectUri: 'https://your-netlify-site.netlify.app/oauth/ebay-success',
  },
};
```

### 3. Configure eBay RuName in Developer Portal

Go to your eBay Developer Account and configure your RuName (`Keith_Zaha-KeithZah-bidpee-mfmwc`) with these settings:

**Auth Accepted URL:** `https://your-domain.com/oauth/ebay-success`
**Auth Declined URL:** `https://your-domain.com/oauth/ebay-declined`

### 4. Build Development Build (Required)

Since custom URL schemes don't work in Expo Go, you'll need to create a development build:

```bash
# Install development build tools
npx expo install expo-dev-client

# Create development build for iOS
npx expo run:ios

# Or for Android
npx expo run:android
```

### 5. Test OAuth Flow

1. Open the app in your development build
2. Go to Account Settings
3. Tap "Connect eBay"
4. Complete authorization in the browser
5. You'll be redirected to your success page
6. The page will automatically redirect back to your app
7. Your eBay account should now be connected

## How It Works

1. **HTTPS Redirect**: eBay redirects to your HTTPS URLs with the authorization code
2. **JavaScript Redirect**: The web pages extract the code and redirect to `bidpeek://` URL scheme
3. **App Handling**: Your app receives the deep link and processes the OAuth callback
4. **Automatic Processing**: The app automatically:
   - Extracts the authorization code
   - Exchanges it for access tokens
   - Stores tokens in Supabase
   - Updates the UI

## Troubleshooting

**If OAuth doesn't work:**

1. Ensure your redirect pages are accessible via HTTPS
2. Check that the RuName URLs exactly match your hosted pages
3. Verify you're using a development build (not Expo Go)
4. Test the redirect pages manually in a browser
5. Check the console logs for any error messages

**Testing the Redirect Pages:**

- Test success: `https://your-domain.com/oauth/ebay-success?code=test123`
- Test declined: `https://your-domain.com/oauth/ebay-declined`

## Environment Support

- **Development/Sandbox**: Uses eBay Sandbox environment with sandbox credentials
- **Production**: Uses eBay Production environment (when `__DEV__` is false)

The OAuth flow automatically adapts to the current environment.
