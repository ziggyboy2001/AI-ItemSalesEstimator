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
  try {
    // Exchange authorization code for tokens
    const tokenData = await exchangeCodeForUserToken(authCode);
    
    // Get eBay user info
    const userInfo = await getEbayUserInfo(tokenData.access_token);
    
    // Calculate expiry time
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    
    // Store in database (upsert to handle existing connections)
    console.log('💾 Storing eBay tokens for user:', userId, 'is_sandbox:', __DEV__);
    
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
      console.error('❌ Failed to store eBay tokens:', error);
      throw error;
    }
    
    console.log('✅ Successfully stored eBay tokens');
    
    return { 
      success: true, 
      ebayUsername: userInfo.username 
    };
  } catch (error) {
    console.error('eBay OAuth callback error:', error);
    return { success: false };
  }
}

/**
 * Get valid access token for user (refresh if necessary)
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const account = await getUserEbayAccount(userId);
  if (!account) {
    throw new Error('No eBay account connected. Please connect your eBay account first.');
  }
  
  const expiresAt = new Date(account.expires_at);
  const validTokens = await ensureValidToken(
    account.access_token,
    account.refresh_token,
    expiresAt
  );
  
  // Update tokens in database if they were refreshed
  if (validTokens.accessToken !== account.access_token) {
    await supabase
      .from('user_ebay_accounts')
      .update({
        access_token: validTokens.accessToken,
        refresh_token: validTokens.refreshToken,
        expires_at: validTokens.expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', account.id);
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
  try {
    // Get valid access token
    const accessToken = await getValidAccessToken(userId);
    
    // Get haul item from database
    const { data: haulItemData, error: fetchError } = await supabase
      .from('haul_items')
      .select('*')
      .eq('id', haulItemId)
      .single();
      
    if (fetchError || !haulItemData) {
      throw new Error('Haul item not found');
    }
    
    // Check if already listed
    if (haulItemData.listed_on_ebay) {
      throw new Error('Item is already listed on eBay');
    }
    
    // Create the listing
    const result = await listHaulItemOnEbay(accessToken, haulItemData, config);
    
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
      console.error('Failed to update haul item with listing info:', updateError);
      // Don't throw here since the listing was successful
    }
    
    return { 
      success: true, 
      listingId: result.listingId 
    };
    
  } catch (error) {
    console.error('Error listing haul item:', error);
    
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