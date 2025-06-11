# OAuth Redirect Pages

These HTML pages handle eBay OAuth redirects and automatically redirect back to the BidPeek app.

## Quick Deployment to Netlify

1. **Go to [Netlify](https://netlify.com)** and create a free account
2. **Drag and drop this `oauth-pages` folder** onto the Netlify dashboard
3. **Note your site URL** (e.g., `https://amazing-site-name.netlify.app`)
4. **Update your app configuration** with your new URLs:
   - Success URL: `https://your-site.netlify.app/ebay-success.html`
   - Declined URL: `https://your-site.netlify.app/ebay-declined.html`

## Testing

Test your deployed pages:

- **Success test**: `https://your-site.netlify.app/ebay-success.html?code=test123`
- **Declined test**: `https://your-site.netlify.app/ebay-declined.html`

Both should attempt to redirect to the BidPeek app.

## Files

- `ebay-success.html` - Handles successful OAuth and redirects to app
- `ebay-declined.html` - Handles cancelled OAuth and redirects to app

## How it Works

1. eBay redirects to your success/decline page with OAuth results
2. JavaScript extracts the authorization code from the URL
3. Page automatically redirects to `bidpeek://oauth/success?code=...`
4. Your app receives the deep link and processes the OAuth
