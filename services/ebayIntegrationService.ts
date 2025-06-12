import { supabase } from './supabaseClient';
import { 
  getEbayUserAuthUrl, 
  exchangeCodeForUserToken, 
  refreshUserToken,
  ensureValidToken,
  EbayUserToken,
  getEbayUserInfo 
} from './ebayUserAuth';
import { 
  listHaulItemOnEbay, 
  HaulItem, 
  ListingConfiguration,
  withdrawOffer,
  deleteInventoryItem 
} from './ebayInventoryApi';

export interface EbayAccount {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  ebay_user_id?: string;
  ebay_username?: string;
  is_sandbox: boolean;
}

/**
 * Check if user has connected eBay account
 */
export async function getUserEbayAccount(userId: string): Promise<EbayAccount | null> {
  console.log('🔍 Checking eBay account for user:', userId, 'is_sandbox:', __DEV__);
  
  const { data, error } = await supabase
    .from('user_ebay_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_sandbox', __DEV__)
    .single();
    
  console.log('📊 Database query result:', { data: !!data, error: error?.code || null });
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    throw error;
  }
  
  return data;
}

/**
 * Generate eBay OAuth URL for user authorization
 */
export function generateEbayAuthUrl(userId: string): string {
  return getEbayUserAuthUrl(userId); // Pass userId as state
}

/**
 * Handle OAuth callback and store tokens
 */
export async function handleEbayOAuthCallback(
  userId: string,
  authCode: string
): Promise<{ success: boolean; ebayUsername?: string }> {
  console.log('🚀 handleEbayOAuthCallback: Starting OAuth callback processing');
  console.log('👤 handleEbayOAuthCallback: User ID:', userId);
  console.log('🔑 handleEbayOAuthCallback: Auth code length:', authCode.length);
  
  try {
    console.log('🔄 handleEbayOAuthCallback: Exchanging code for tokens...');
    // Exchange authorization code for tokens
    const tokenData = await exchangeCodeForUserToken(authCode);
    console.log('✅ handleEbayOAuthCallback: Token exchange successful');
    
    console.log('👤 handleEbayOAuthCallback: Getting eBay user info...');
    // Get eBay user info
    const userInfo = await getEbayUserInfo(tokenData.access_token);
    console.log('✅ handleEbayOAuthCallback: Got user info:', {
      userId: userInfo.userId,
      username: userInfo.username
    });
    
    // Calculate expiry time
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    console.log('⏰ handleEbayOAuthCallback: Token expires at:', expiresAt.toISOString());
    
    // Store in database (upsert to handle existing connections)
    console.log('💾 handleEbayOAuthCallback: Storing tokens in database...');
    
    const { error } = await supabase
      .from('user_ebay_accounts')
      .upsert({
        user_id: userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        ebay_user_id: userInfo.userId,
        ebay_username: userInfo.username,
        is_sandbox: __DEV__,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,is_sandbox'
      });
      
    if (error) {
      console.error('❌ handleEbayOAuthCallback: Database error:', error);
      throw error;
    }
    
    console.log('✅ handleEbayOAuthCallback: Tokens stored successfully');
    
    return { 
      success: true, 
      ebayUsername: userInfo.username 
    };
  } catch (error) {
    console.error('❌ handleEbayOAuthCallback: Error occurred:', error);
    return { success: false };
  }
}

/**
 * Get valid access token for user (refresh if necessary)
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  console.log('🔑 getValidAccessToken: Starting for userId:', userId);
  
  const account = await getUserEbayAccount(userId);
  if (!account) {
    console.log('❌ getValidAccessToken: No eBay account found');
    throw new Error('No eBay account connected. Please connect your eBay account first.');
  }
  
  console.log('✅ getValidAccessToken: Found eBay account:', {
    id: account.id,
    username: account.ebay_username,
    expires_at: account.expires_at,
    is_sandbox: account.is_sandbox
  });
  
  const expiresAt = new Date(account.expires_at);
  console.log('🔄 getValidAccessToken: Ensuring token validity...');
  
  const validTokens = await ensureValidToken(
    account.access_token,
    account.refresh_token,
    expiresAt
  );
  
  console.log('✅ getValidAccessToken: Token validation complete, refreshed:', 
    validTokens.accessToken !== account.access_token);
  
  // Update tokens in database if they were refreshed
  if (validTokens.accessToken !== account.access_token) {
    console.log('💾 getValidAccessToken: Updating refreshed tokens in database...');
    await supabase
      .from('user_ebay_accounts')
      .update({
        access_token: validTokens.accessToken,
        refresh_token: validTokens.refreshToken,
        expires_at: validTokens.expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', account.id);
    console.log('✅ getValidAccessToken: Database updated with new tokens');
  }
  
  return validTokens.accessToken;
}

/**
 * List a haul item on eBay and update database
 */
export async function listHaulItem(
  userId: string,
  haulItemId: string,
  config: ListingConfiguration
): Promise<{ success: boolean; listingId?: string; error?: string }> {
  console.log('🚀 listHaulItem: Starting with params:', {
    userId,
    haulItemId,
    categoryId: config.categoryId,
    condition: config.condition,
    price: config.price
  });
  
  try {
    console.log('🔑 listHaulItem: Getting valid access token...');
    // Get valid access token
    const accessToken = await getValidAccessToken(userId);
    console.log('✅ listHaulItem: Got access token:', accessToken.substring(0, 20) + '...');
    
    console.log('📊 listHaulItem: Fetching haul item from database...');
    // Get haul item from database
    const { data: haulItemData, error: fetchError } = await supabase
      .from('haul_items')
      .select('*')
      .eq('id', haulItemId)
      .single();
      
    if (fetchError || !haulItemData) {
      console.log('❌ listHaulItem: Haul item not found:', fetchError);
      throw new Error('Haul item not found');
    }
    
    console.log('✅ listHaulItem: Found haul item:', {
      id: haulItemData.id,
      title: haulItemData.title,
      already_listed: haulItemData.listed_on_ebay
    });
    
    // Check if already listed
    if (haulItemData.listed_on_ebay) {
      console.log('❌ listHaulItem: Item already listed on eBay');
      throw new Error('Item is already listed on eBay');
    }
    
    console.log('🏪 listHaulItem: Creating eBay listing...');
    try {
      // Create the listing
      const result = await listHaulItemOnEbay(accessToken, haulItemData, config);
      console.log('✅ listHaulItem: eBay listing created:', {
        sku: result.sku,
        offerId: result.offerId,
        listingId: result.listingId
      });
      
      console.log('💾 listHaulItem: Updating database with listing info...');
      // Update database with listing information
      const { error: updateError } = await supabase
        .from('haul_items')
        .update({
          ebay_sku: result.sku,
          ebay_offer_id: result.offerId,
          ebay_listing_id: result.listingId,
          listed_on_ebay: true,
          listed_at: new Date().toISOString(),
          listing_status: 'active',
          ebay_category_id: config.categoryId,
          listing_price: config.price || haulItemData.sale_price,
          listing_condition: config.condition
        })
        .eq('id', haulItemId);
        
      if (updateError) {
        console.error('❌ listHaulItem: Failed to update haul item with listing info:', updateError);
        // Don't throw here since the listing was successful
      } else {
        console.log('✅ listHaulItem: Database updated successfully');
      }
      
      console.log('🎉 listHaulItem: Process completed successfully');
      return { 
        success: true, 
        listingId: result.listingId 
      };
      
    } catch (listingError) {
      console.error('❌ listHaulItem: eBay listing creation failed:', listingError);
      throw listingError; // Re-throw to be caught by outer try-catch
    }
    
  } catch (error) {
    console.error('❌ listHaulItem: Error occurred:', error);
    
    // Check if this is a re-authentication required error
    if (error instanceof Error && error.message === 'EBAY_REAUTH_REQUIRED') {
      console.log('🔄 listHaulItem: eBay re-authentication required');
      
      // Clear the stored eBay account to force re-authentication
      try {
        await disconnectEbayAccount(userId);
        console.log('✅ listHaulItem: Cleared expired eBay account');
      } catch (disconnectError) {
        console.error('❌ listHaulItem: Failed to clear eBay account:', disconnectError);
      }
      
      return { 
        success: false, 
        error: 'EBAY_REAUTH_REQUIRED' // Special error code that the UI can handle
      };
    }
    
    console.log('💾 listHaulItem: Updating database with error status...');
    // Update database with error status
    await supabase
      .from('haul_items')
      .update({
        listing_status: 'error'
      })
      .eq('id', haulItemId);
      
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Remove/end eBay listing for a haul item
 */
export async function removeEbayListing(
  userId: string,
  haulItemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getValidAccessToken(userId);
    
    // Get haul item with eBay listing info
    const { data: haulItemData, error: fetchError } = await supabase
      .from('haul_items')
      .select('*')
      .eq('id', haulItemId)
      .single();
      
    if (fetchError || !haulItemData) {
      throw new Error('Haul item not found');
    }
    
    if (!haulItemData.listed_on_ebay || !haulItemData.ebay_offer_id) {
      throw new Error('Item is not listed on eBay');
    }
    
    // Withdraw the offer (ends the listing)
    if (haulItemData.ebay_offer_id) {
      await withdrawOffer(accessToken, haulItemData.ebay_offer_id);
    }
    
    // Delete inventory item
    if (haulItemData.ebay_sku) {
      await deleteInventoryItem(accessToken, haulItemData.ebay_sku);
    }
    
    // Update database
    const { error: updateError } = await supabase
      .from('haul_items')
      .update({
        listed_on_ebay: false,
        listing_status: 'ended',
        ebay_sku: null,
        ebay_offer_id: null,
        ebay_listing_id: null
      })
      .eq('id', haulItemId);
      
    if (updateError) {
      console.error('Failed to update haul item after removing listing:', updateError);
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('Error removing eBay listing:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Disconnect user's eBay account
 */
export async function disconnectEbayAccount(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_ebay_accounts')
    .delete()
    .eq('user_id', userId)
    .eq('is_sandbox', __DEV__);
    
  if (error) {
    throw error;
  }
}

/**
 * Get user's eBay listings status
 */
export async function getUserEbayListings(userId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('haul_items')
    .select(`
      id,
      title,
      image_url,
      sale_price,
      listing_price,
      listed_on_ebay,
      listing_status,
      ebay_listing_id,
      listed_at,
      hauls!inner(user_id)
    `)
    .eq('hauls.user_id', userId)
    .eq('listed_on_ebay', true)
    .order('listed_at', { ascending: false });
    
  if (error) {
    throw error;
  }
  
  return data || [];
}

/**
 * Check eBay connection status for user
 */
export async function checkEbayConnection(userId: string): Promise<{
  connected: boolean;
  username?: string;
  expiresAt?: string;
}> {
  const account = await getUserEbayAccount(userId);
  
  if (!account) {
    return { connected: false };
  }
  
  return {
    connected: true,
    username: account.ebay_username,
    expiresAt: account.expires_at
  };
} 