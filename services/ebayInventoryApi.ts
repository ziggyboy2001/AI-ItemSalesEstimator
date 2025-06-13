import { LISTING_CONFIG } from './ebayApi';
import { EbayErrorHandler } from './ebayErrorHandlingService';

export interface EbayInventoryItem {
  sku: string;
  product: {
    title: string;
    description: string;
    imageUrls: string[];
    aspects?: Record<string, string[]>;
  };
  condition: 'NEW' | 'USED_LIKE_NEW' | 'USED_EXCELLENT' | 'USED_VERY_GOOD' | 'USED_GOOD' | 'USED_ACCEPTABLE';
  availability: {
    shipToLocationAvailability: {
      quantity: number;
    };
  };
  locale?: string;
}

export interface EbayOffer {
  sku: string;
  marketplaceId: 'EBAY_US';
  format: 'FIXED_PRICE' | 'AUCTION';
  pricingSummary: {
    price: {
      value: string;
      currency: 'USD';
    };
  };
  listingPolicies: {
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
  };
  categoryId: string;
  merchantLocationKey?: string;
  tax?: {
    applyTax: boolean;
    thirdPartyTaxCategory?: string;
  };
}

export interface HaulItem {
  id: string;
  title: string;
  image_url?: string;
  additional_images?: string[];
  sale_price: number;
  purchase_price: number;
  ebay_item_id?: string;
}

export interface ListingConfiguration {
  categoryId: string;
  condition: 'NEW' | 'USED_LIKE_NEW' | 'USED_EXCELLENT' | 'USED_VERY_GOOD' | 'USED_GOOD' | 'USED_ACCEPTABLE';
  price?: number; // Override haul item price if needed
  description?: string;
  title?: string; // Override haul item title if needed
  images?: string[]; // User-provided images
  aspects?: Record<string, string[]>; // Phase 3 Step 3.1: Dynamic aspects
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  merchantLocationKey?: string;
  country?: string; // User's country for location-based listings
}

/**
 * Create an inventory item in eBay's system
 */
export async function createInventoryItem(
  userAccessToken: string,
  inventoryItem: EbayInventoryItem
): Promise<{ success: boolean; warnings?: any[] }> {
  console.log('📦 createInventoryItem: Making API call to eBay...');
  console.log('📦 createInventoryItem: URL:', `${LISTING_CONFIG.inventoryUrl}/inventory_item/${inventoryItem.sku}`);
  console.log('📦 createInventoryItem: Inventory item:', {
    sku: inventoryItem.sku,
    title: inventoryItem.product.title,
    imageCount: inventoryItem.product.imageUrls.length,
    condition: inventoryItem.condition
  });
  
  const response = await fetch(`${LISTING_CONFIG.inventoryUrl}/inventory_item/${inventoryItem.sku}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json',
      'Content-Language': 'en-US'
    },
    body: JSON.stringify(inventoryItem)
  });

  console.log('📦 createInventoryItem: Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.log('❌ createInventoryItem: Error response:', errorText);
    
    // Phase 3 Step 3.2: Enhanced error parsing
    try {
      const errorData = JSON.parse(errorText);
      const parsedError = EbayErrorHandler.parseEbayError(errorData);
      throw new Error(parsedError);
    } catch (parseError) {
      throw new Error(`Failed to create inventory item: ${errorText}`);
    }
  }

  // PUT returns 204 No Content on success, or warnings if any
  if (response.status === 204) {
    console.log('✅ createInventoryItem: Success (204 No Content)');
    return { success: true };
  }

  const result = await response.json();
  console.log('✅ createInventoryItem: Success with result:', result.warnings ? 'with warnings' : '');
  return result;
}

/**
 * Create an offer for an inventory item
 */
export async function createOffer(
  userAccessToken: string,
  offer: EbayOffer
): Promise<{ offerId: string }> {
  const response = await fetch(`${LISTING_CONFIG.inventoryUrl}/offer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json',
      'Content-Language': 'en-US'
    },
    body: JSON.stringify(offer)
  });

  if (!response.ok) {
    const errorText = await response.text();
    
    // Phase 3 Step 3.2: Enhanced error parsing
    try {
      const errorData = JSON.parse(errorText);
      const parsedError = EbayErrorHandler.parseEbayError(errorData);
      throw new Error(parsedError);
    } catch (parseError) {
      throw new Error(`Failed to create offer: ${errorText}`);
    }
  }

  return await response.json();
}

/**
 * Publish an offer to make it live on eBay
 */
export async function publishOffer(
  userAccessToken: string,
  offerId: string
): Promise<{ listingId: string; itemWebUrl?: string }> {
  const response = await fetch(`${LISTING_CONFIG.inventoryUrl}/offer/${offerId}/publish`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json',
      'Content-Language': 'en-US'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    
    // Phase 3 Step 3.2: Enhanced error parsing for publishing
    try {
      const errorData = JSON.parse(errorText);
      const parsedError = EbayErrorHandler.parseEbayError(errorData);
      
      // Special handling for common publishing errors
      if (parsedError.includes('not a leaf category')) {
        throw new Error('CATEGORY_NOT_LEAF');
      } else if (parsedError.includes('item specific') && parsedError.includes('missing')) {
        const match = parsedError.match(/The item specific ([^.]+) is missing/);
        const missingField = match ? match[1] : 'required field';
        throw new Error(`MISSING_REQUIRED_FIELD:${missingField}`);
      }
      
      throw new Error(parsedError);
    } catch (parseError) {
      throw new Error(`Failed to publish offer: ${errorText}`);
    }
  }

  return await response.json();
}

/**
 * Get offer details by offer ID
 */
export async function getOffer(
  userAccessToken: string,
  offerId: string
): Promise<any> {
  const response = await fetch(`${LISTING_CONFIG.inventoryUrl}/offer/${offerId}`, {
    headers: {
      'Authorization': `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get offer: ${error}`);
  }

  return await response.json();
}

/**
 * Delete an inventory item
 */
export async function deleteInventoryItem(
  userAccessToken: string,
  sku: string
): Promise<void> {
  const response = await fetch(`${LISTING_CONFIG.inventoryUrl}/inventory_item/${sku}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    throw new Error(`Failed to delete inventory item: ${error}`);
  }
}

/**
 * End/withdraw an offer
 */
export async function withdrawOffer(
  userAccessToken: string,
  offerId: string
): Promise<void> {
  const response = await fetch(`${LISTING_CONFIG.inventoryUrl}/offer/${offerId}/withdraw`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to withdraw offer: ${error}`);
  }
}

/**
 * Main function to list a haul item on eBay
 */
export async function listHaulItemOnEbay(
  userAccessToken: string,
  haulItem: HaulItem,
  config: ListingConfiguration
): Promise<{ 
  success: boolean;
  sku?: string; 
  offerId?: string; 
  listingId?: string; 
  itemWebUrl?: string;
  error?: string;
}> {
  try {
    console.log('🏪 listHaulItemOnEbay: Starting with params:', {
      haulItemId: haulItem.id,
      haulItemTitle: haulItem.title,
      configPrice: config.price,
      configCategoryId: config.categoryId,
      configCondition: config.condition,
      hasDescription: !!config.description,
      hasImages: !!(haulItem.image_url || haulItem.additional_images?.length)
    });
    
    console.log('🔍 DEBUG: Function version check - location creation enabled');
    
    // Skip location setup - let eBay handle it automatically
    console.log('⚠️ listHaulItemOnEbay: Skipping location setup for sandbox compatibility');
  
  // Create eBay-compliant SKU: alphanumeric only, max 50 chars
  const cleanId = haulItem.id.replace(/[^a-zA-Z0-9]/g, ''); // Remove hyphens and other special chars
  const timestamp = Date.now().toString();
  const sku = `haul${cleanId}${timestamp}`.substring(0, 50); // Ensure max 50 chars
  console.log('📝 listHaulItemOnEbay: Generated SKU:', sku);
  
  // Step 1: Create inventory item
  console.log('🖼️ listHaulItemOnEbay: Preparing images...');
  const allImages = [];
  
  // Helper function to ensure URLs have proper protocol
  const ensureProtocol = (url: string): string => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('ftp://')) {
      return url;
    }
    // Default to https if no protocol is present
    return `https://${url}`;
  };
  
  if (haulItem.image_url) allImages.push(ensureProtocol(haulItem.image_url));
  if (haulItem.additional_images) {
    allImages.push(...haulItem.additional_images.map(ensureProtocol));
  }
  console.log('✅ listHaulItemOnEbay: Found', allImages.length, 'images');

  // Phase 3 Step 3.1: Enhanced inventory item with dynamic aspects
  const inventoryItem: EbayInventoryItem = {
    sku,
    product: {
      title: config.title || haulItem.title,
      description: config.description || generateDescription(haulItem),
      imageUrls: (config.images ? config.images.map(ensureProtocol) : allImages).slice(0, 12), // Use user images if provided, otherwise eBay allows max 12 images
      // ENHANCED: Include all aspects (auto-detected + user-provided)
      aspects: {
        ...generateItemAspects(config.categoryId, haulItem.title), // Fallback aspects
        ...config.aspects, // User-provided aspects take precedence
      },
    },
    condition: config.condition,
    availability: {
      shipToLocationAvailability: {
        quantity: 1
      }
    }
  };

  console.log('📦 Creating inventory item with aspects:', inventoryItem.product.aspects);

  console.log('📦 listHaulItemOnEbay: Creating inventory item...');
  await createInventoryItem(userAccessToken, inventoryItem);
  console.log('✅ listHaulItemOnEbay: Inventory item created');

  // Step 2: Create offer
  console.log('💰 listHaulItemOnEbay: Creating offer...');
  
  const offer: EbayOffer = {
    sku,
    marketplaceId: 'EBAY_US',
    format: 'FIXED_PRICE',
    pricingSummary: {
      price: {
        value: (config.price || haulItem.sale_price).toString(),
        currency: 'USD'
      }
    },
    listingPolicies: {
      fulfillmentPolicyId: config.fulfillmentPolicyId || '6209718000',
      paymentPolicyId: config.paymentPolicyId || '6209719000',
      returnPolicyId: config.returnPolicyId || '6209720000'
    },
    categoryId: config.categoryId, // Phase 3 Step 3.1: Use dynamic category ID
    merchantLocationKey: config.merchantLocationKey || 'bidpeeksbx'
  };

  console.log('📄 listHaulItemOnEbay: Offer config:', {
    sku: offer.sku,
    price: offer.pricingSummary.price.value,
    categoryId: offer.categoryId,
    hasPolicies: !!(config.fulfillmentPolicyId || config.paymentPolicyId || config.returnPolicyId)
  });

  const { offerId } = await createOffer(userAccessToken, offer);
  console.log('✅ listHaulItemOnEbay: Offer created with ID:', offerId);

  // Step 3: Publish the listing
  console.log('🚀 listHaulItemOnEbay: Publishing offer...');
  const { listingId, itemWebUrl } = await publishOffer(userAccessToken, offerId);
  console.log('✅ listHaulItemOnEbay: Listing published with ID:', listingId);

    return { 
      success: true,
      sku, 
      offerId, 
      listingId, 
      itemWebUrl 
    };
  } catch (error) {
    console.error('❌ listHaulItemOnEbay: Error occurred:', error);
    
    // Phase 3 Step 3.2: Enhanced error handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const parsedError = EbayErrorHandler.parseEbayError(error);
    const userFriendlyError = EbayErrorHandler.getUserFriendlyError(parsedError);
    
    return {
      success: false,
      error: userFriendlyError,
    };
  }
}

/**
 * Generate item aspects (item specifics) based on category and title
 */
function generateItemAspects(categoryId: string, title: string): Record<string, string[]> {
  const aspects: Record<string, string[]> = {};
  
  // Video game categories require Platform and Game Name
  if (categoryId === '139973') { // Nintendo Game Boy Advance
    aspects['Platform'] = ['Nintendo Game Boy Advance'];
    aspects['Game Name'] = [extractGameName(title)];
  } else if (categoryId === '175672') { // General Video Games
    // Try to detect platform from title
    const titleLower = title.toLowerCase();
    if (titleLower.includes('gba') || titleLower.includes('game boy advance')) {
      aspects['Platform'] = ['Nintendo Game Boy Advance'];
      aspects['Game Name'] = [extractGameName(title)];
    } else if (titleLower.includes('ds') || titleLower.includes('nintendo ds')) {
      aspects['Platform'] = ['Nintendo DS'];
      aspects['Game Name'] = [extractGameName(title)];
    } else if (titleLower.includes('3ds')) {
      aspects['Platform'] = ['Nintendo 3DS'];
      aspects['Game Name'] = [extractGameName(title)];
    } else if (titleLower.includes('switch')) {
      aspects['Platform'] = ['Nintendo Switch'];
      aspects['Game Name'] = [extractGameName(title)];
    } else if (titleLower.includes('playstation') || titleLower.includes('ps')) {
      aspects['Platform'] = ['Sony PlayStation'];
      aspects['Game Name'] = [extractGameName(title)];
    } else if (titleLower.includes('xbox')) {
      aspects['Platform'] = ['Microsoft Xbox'];
      aspects['Game Name'] = [extractGameName(title)];
    } else {
      // Default fallback
      aspects['Platform'] = ['Nintendo Game Boy Advance'];
      aspects['Game Name'] = [extractGameName(title)];
    }
  }
  
  return aspects;
}

/**
 * Extract game name from title by removing platform indicators and common suffixes
 */
function extractGameName(title: string): string {
  let gameName = title;
  
  // Remove common platform indicators (case insensitive)
  const platformIndicators = [
    /\bgba\b/gi,
    /\bgame boy advance\b/gi,
    /\bnintendo ds\b/gi,
    /\b3ds\b/gi,
    /\bnintendo switch\b/gi,
    /\bswitch\b/gi,
    /\bplaystation\b/gi,
    /\bps[1-5]\b/gi,
    /\bxbox\b/gi,
    /\bnintendo\b/gi
  ];
  
  platformIndicators.forEach(indicator => {
    gameName = gameName.replace(indicator, '');
  });
  
  // Clean up extra spaces and trim
  gameName = gameName.replace(/\s+/g, ' ').trim();
  
  // If the cleaned name is too short or empty, use the original title
  if (gameName.length < 3) {
    gameName = title;
  }
  
  return gameName;
}

/**
 * Generate a basic description for a haul item
 */
function generateDescription(haulItem: HaulItem): string {
  return `
<div>
  <h3>${haulItem.title}</h3>
  <p>This item is being resold in excellent condition.</p>
  <p><strong>Key Details:</strong></p>
  <ul>
    <li>Carefully inspected and ready for shipment</li>
    <li>Fast and secure shipping</li>
    <li>Returns accepted - see return policy</li>
  </ul>
  <p>Thank you for your interest in this item!</p>
</div>
  `.trim();
}

/**
 * Fetch eBay categories (basic implementation)
 */
export async function getCategories(
  userAccessToken: string,
  parentCategoryId?: string
): Promise<any> {
  const url = parentCategoryId 
    ? `${LISTING_CONFIG.inventoryUrl}/category_tree/0/${parentCategoryId}`
    : `${LISTING_CONFIG.inventoryUrl}/category_tree/0`;
    
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get categories: ${error}`);
  }

  return await response.json();
}

/**
 * Create or find a suitable inventory location following eBay's official guidelines
 */
export async function createDefaultLocation(
  userAccessToken: string,
  country: string = 'US'
): Promise<{ merchantLocationKey: string }> {
  console.log('🔧 createDefaultLocation: Starting location management for country:', country);
  
  // Step 1: Check if any locations exist first (per eBay guidelines)
  try {
    const listUrl = `${LISTING_CONFIG.inventoryUrl}/location`;
    console.log('🔍 createDefaultLocation: Checking existing locations...');
    
    const listResponse = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userAccessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (listResponse.ok) {
      const locationData = await listResponse.json();
      console.log('📋 createDefaultLocation: Found existing locations:', locationData.total || 0);
      
      if (locationData.locations && locationData.locations.length > 0) {
        // Use the first enabled location
        const enabledLocation = locationData.locations.find(
          (loc: any) => loc.merchantLocationStatus === 'ENABLED'
        ) || locationData.locations[0];
        
        console.log('✅ createDefaultLocation: Using existing location:', enabledLocation.merchantLocationKey);
        return { merchantLocationKey: enabledLocation.merchantLocationKey };
      }
    } else {
      console.log('⚠️ createDefaultLocation: Could not list locations, status:', listResponse.status);
    }
  } catch (error) {
    console.log('⚠️ createDefaultLocation: Error checking existing locations:', error);
  }
  
  // Step 2: Create a new location using the exact InventoryLocationFull schema
  const merchantLocationKey = 'warehouse_default';
  
  // This payload follows the exact InventoryLocationFull schema from the OpenAPI contract
  const locationPayload = {
    name: 'Default Warehouse Location',
    merchantLocationStatus: 'ENABLED',
    locationTypes: ['WAREHOUSE'],
    location: {
      address: {
        addressLine1: '123 Market Street',  // This was missing!
        city: 'San Francisco',
        stateOrProvince: 'CA',
        country: 'US',
        postalCode: '94102'
      }
    },
    phone: '+14155551234'
  };

  console.log('🔧 createDefaultLocation: Creating new warehouse location with data:', locationPayload);

  try {
    const url = `${LISTING_CONFIG.inventoryUrl}/location/${merchantLocationKey}`;
    console.log('🔧 createDefaultLocation: Making PUT request to:', url);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${userAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(locationPayload)
    });

    console.log('🔧 createDefaultLocation: Response status:', response.status);

    if (response.status === 204) {
      // 204 = created successfully per eBay API docs
      console.log('✅ createDefaultLocation: Warehouse location created successfully');
      return { merchantLocationKey };
    } else if (response.status === 409) {
      // 409 = already exists
      console.log('✅ createDefaultLocation: Warehouse location already exists');
      return { merchantLocationKey };
    } else {
      const error = await response.text();
      console.log('❌ createDefaultLocation: Failed to create location:', response.status, error);
      throw new Error(`Failed to create inventory location: ${error}`);
    }
  } catch (error) {
    console.log('❌ createDefaultLocation: Exception during location creation:', error);
    throw error;
  }
} 