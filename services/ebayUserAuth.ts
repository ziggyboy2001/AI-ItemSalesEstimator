import { Buffer } from 'buffer';
import { LISTING_CONFIG, EBAY_USER_SCOPES } from './ebayApi';

export interface EbayUserToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface EbayUserInfo {
  userId: string;
  username: string;
  email?: string;
}

/**
 * Generate the eBay OAuth authorization URL for user consent
 */
export function getEbayUserAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: LISTING_CONFIG.clientId,
    response_type: 'code',
    redirect_uri: LISTING_CONFIG.redirectUri,
    scope: EBAY_USER_SCOPES,
    ...(state && { state })
  });

  return `${LISTING_CONFIG.oauthUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for user access token
 */
export async function exchangeCodeForUserToken(
  authCode: string,
  state?: string
): Promise<EbayUserToken> {
  console.log('🔄 Starting token exchange...');
  console.log('📝 Auth code:', authCode.substring(0, 20) + '...');
  console.log('🔗 Auth URL:', LISTING_CONFIG.authUrl);
  console.log('🆔 Client ID:', LISTING_CONFIG.clientId);
  console.log('🔑 Client Secret:', LISTING_CONFIG.clientSecret.substring(0, 10) + '...');
  console.log('🌐 Redirect URI:', LISTING_CONFIG.redirectUri);
  
  const credentials = Buffer.from(`${LISTING_CONFIG.clientId}:${LISTING_CONFIG.clientSecret}`).toString('base64');
  console.log('🔐 Base64 credentials length:', credentials.length);
  
  // Manual body construction to avoid double URL encoding
  const requestBody = `grant_type=authorization_code&code=${encodeURIComponent(authCode)}&redirect_uri=${encodeURIComponent(LISTING_CONFIG.redirectUri)}`;
  
  console.log('📦 Request body:', requestBody);
  console.log('📋 Full request details:', {
    url: LISTING_CONFIG.authUrl,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials.substring(0, 20)}...`
    }
  });
  
  const response = await fetch(LISTING_CONFIG.authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`
    },
    body: requestBody
  });

  console.log('📊 Response status:', response.status);
  console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));

  const responseText = await response.text();
  console.log('📄 Raw response:', responseText);

  if (!response.ok) {
    console.error('❌ Token exchange failed:', responseText);
    throw new Error(`eBay OAuth error: ${responseText}`);
  }

  const tokenData = JSON.parse(responseText);
  
  if (!tokenData.access_token) {
    console.error('❌ No access token in response:', tokenData);
    throw new Error('No access token received from eBay OAuth');
  }

  console.log('✅ Token exchange successful');
  return tokenData;
}

/**
 * Refresh expired user access token
 */
export async function refreshUserToken(refreshToken: string): Promise<EbayUserToken> {
  const credentials = Buffer.from(`${LISTING_CONFIG.clientId}:${LISTING_CONFIG.clientSecret}`).toString('base64');
  
  const response = await fetch(LISTING_CONFIG.authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: EBAY_USER_SCOPES
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`eBay token refresh error: ${error}`);
  }

  return await response.json();
}

/**
 * Get user information from eBay using access token
 */
export async function getEbayUserInfo(accessToken: string): Promise<EbayUserInfo> {
  // Use sandbox URL for sandbox environment
  const userInfoUrl = LISTING_CONFIG.authUrl.includes('sandbox') 
    ? 'https://apiz.sandbox.ebay.com/commerce/identity/v1/user'
    : 'https://apiz.ebay.com/commerce/identity/v1/user';
    
  console.log('🔍 Getting user info from:', userInfoUrl);
  
  const response = await fetch(userInfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ User info error:', error);
    throw new Error(`Failed to get eBay user info: ${error}`);
  }

  const userData = await response.json();
  console.log('✅ User info received:', userData);
  
  return {
    userId: userData.userId,
    username: userData.username,
    email: userData.email
  };
}

/**
 * Check if an access token is still valid
 */
export async function validateAccessToken(accessToken: string): Promise<boolean> {
  try {
    await getEbayUserInfo(accessToken);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Helper to manage token lifecycle - refresh if expired
 */
export async function ensureValidToken(
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const now = new Date();
  const expiryBuffer = 5 * 60 * 1000; // 5 minutes buffer
  
  // If token is still valid (with buffer), return current
  if (expiresAt.getTime() > now.getTime() + expiryBuffer) {
    return { accessToken, refreshToken, expiresAt };
  }
  
  // Refresh the token
  const newTokenData = await refreshUserToken(refreshToken);
  
  return {
    accessToken: newTokenData.access_token,
    refreshToken: newTokenData.refresh_token,
    expiresAt: new Date(now.getTime() + (newTokenData.expires_in * 1000))
  };
} 