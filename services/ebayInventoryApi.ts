import { LISTING_CONFIG } from './ebayApi';

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
    const error = await response.text();
    console.log('❌ createInventoryItem: Error response:', error);
    throw new Error(`Failed to create inventory item: ${error}`);
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
    const error = await response.text();
    throw new Error(`Failed to create offer: ${error}`);
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
    const error = await response.text();
    throw new Error(`Failed to publish offer: ${error}`);
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
  sku: string; 
  offerId: string; 
  listingId: string; 
  itemWebUrl?: string 
}> {
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
  
  // Try to create a default location first (required for offers)
  try {
    console.log('🏗️ listHaulItemOnEbay: Attempting to create default location...');
    const { merchantLocationKey } = await createDefaultLocation(userAccessToken, config.country || 'US');
    console.log('✅ listHaulItemOnEbay: Location setup completed with key:', merchantLocationKey);
  } catch (error) {
    console.log('⚠️ listHaulItemOnEbay: Location creation failed, will use default:', error);
  }
  
  // Create eBay-compliant SKU: alphanumeric only, max 50 chars
  const cleanId = haulItem.id.replace(/[^a-zA-Z0-9]/g, ''); // Remove hyphens and other special chars
  const timestamp = Date.now().toString();
  const sku = `haul${cleanId}${timestamp}`.substring(0, 50); // Ensure max 50 chars
  console.log('📝 listHaulItemOnEbay: Generated SKU:', sku);
  
  // Step 1: Create inventory item
  console.log('🖼️ listHaulItemOnEbay: Preparing images...');
  const allImages = [];
  if (haulItem.image_url) allImages.push(haulItem.image_url);
  if (haulItem.additional_images) allImages.push(...haulItem.additional_images);
  console.log('✅ listHaulItemOnEbay: Found', allImages.length, 'images');

  const inventoryItem: EbayInventoryItem = {
    sku,
    product: {
      title: config.title || haulItem.title,
      description: config.description || generateDescription(haulItem),
      imageUrls: config.images || allImages.slice(0, 12) // Use user images if provided, otherwise eBay allows max 12 images
    },
    condition: config.condition,
    availability: {
      shipToLocationAvailability: {
        quantity: 1
      }
    }
  };

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
      fulfillmentPolicyId: config.fulfillmentPolicyId,
      paymentPolicyId: config.paymentPolicyId,
      returnPolicyId: config.returnPolicyId
    },
    categoryId: config.categoryId,
    merchantLocationKey: 'default'  // Use default location key for eBay sandbox
  };

  console.log('📄 listHaulItemOnEbay: Offer config:', {
    sku: offer.sku,
    price: offer.pricingSummary.price.value,
    categoryId: offer.categoryId,
    merchantLocationKey: offer.merchantLocationKey,
    hasPolicies: !!(config.fulfillmentPolicyId || config.paymentPolicyId || config.returnPolicyId)
  });

  const { offerId } = await createOffer(userAccessToken, offer);
  console.log('✅ listHaulItemOnEbay: Offer created with ID:', offerId);

  // Step 3: Publish the listing
  console.log('🚀 listHaulItemOnEbay: Publishing offer...');
  const { listingId, itemWebUrl } = await publishOffer(userAccessToken, offerId);
  console.log('✅ listHaulItemOnEbay: Listing published with ID:', listingId);

  return { sku, offerId, listingId, itemWebUrl };
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
 * Create a default inventory location for the user if none exists
 */
export async function createDefaultLocation(
  userAccessToken: string,
  country: string = 'US'
): Promise<{ merchantLocationKey: string }> {
  console.log('🔧 createDefaultLocation: Starting location creation for country:', country);
  const merchantLocationKey = `default_warehouse_${country.toLowerCase()}`;
  
  // Default locations for different countries
  const locationConfigs = {
    'US': {
      city: 'San Francisco',
      stateOrProvince: 'CA',
      country: 'US',
      postalCode: '94102'
    },
    'CA': {
      city: 'Toronto',
      stateOrProvince: 'ON',
      country: 'CA',
      postalCode: 'M5H 2N2'
    },
    'UK': {
      city: 'London',
      stateOrProvince: 'England',
      country: 'GB',
      postalCode: 'SW1A 1AA'
    },
    'AU': {
      city: 'Sydney',
      stateOrProvince: 'NSW',
      country: 'AU',
      postalCode: '2000'
    }
  };
  
  const addressConfig = locationConfigs[country as keyof typeof locationConfigs] || locationConfigs['US'];
  
  const locationData = {
    location: {
      address: addressConfig
    },
    name: `Default Warehouse Location (${country})`,
    locationTypes: ['WAREHOUSE'],
    merchantLocationStatus: 'ENABLED'
  };

  console.log('🔧 createDefaultLocation: Location data:', locationData);

  try {
    const url = `${LISTING_CONFIG.inventoryUrl}/location/${merchantLocationKey}`;
    console.log('🔧 createDefaultLocation: Making request to:', url);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${userAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(locationData)
    });

    console.log('🔧 createDefaultLocation: Response status:', response.status);

    if (response.ok || response.status === 409) {
      // 204 = created successfully, 409 = already exists
      console.log('✅ createDefaultLocation: Location created or already exists');
      return { merchantLocationKey };
    } else {
      const error = await response.text();
      console.log('⚠️ createDefaultLocation: Non-fatal error:', response.status, error);
      // Return the key anyway, it might work
      return { merchantLocationKey };
    }
  } catch (error) {
    console.log('⚠️ createDefaultLocation: Error, proceeding anyway:', error);
    return { merchantLocationKey };
  }
} 