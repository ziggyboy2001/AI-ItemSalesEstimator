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
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  merchantLocationKey?: string;
}

/**
 * Create an inventory item in eBay's system
 */
export async function createInventoryItem(
  userAccessToken: string,
  inventoryItem: EbayInventoryItem
): Promise<{ success: boolean; warnings?: any[] }> {
  const response = await fetch(`${LISTING_CONFIG.inventoryUrl}/inventory_item/${inventoryItem.sku}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json',
      'Content-Language': 'en-US'
    },
    body: JSON.stringify(inventoryItem)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create inventory item: ${error}`);
  }

  // PUT returns 204 No Content on success, or warnings if any
  if (response.status === 204) {
    return { success: true };
  }

  return await response.json();
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
  const sku = `haul_${haulItem.id}_${Date.now()}`;
  
  // Step 1: Create inventory item
  const allImages = [];
  if (haulItem.image_url) allImages.push(haulItem.image_url);
  if (haulItem.additional_images) allImages.push(...haulItem.additional_images);

  const inventoryItem: EbayInventoryItem = {
    sku,
    product: {
      title: haulItem.title,
      description: config.description || generateDescription(haulItem),
      imageUrls: allImages.slice(0, 12) // eBay allows max 12 images
    },
    condition: config.condition,
    availability: {
      shipToLocationAvailability: {
        quantity: 1
      }
    }
  };

  await createInventoryItem(userAccessToken, inventoryItem);

  // Step 2: Create offer
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
    merchantLocationKey: config.merchantLocationKey
  };

  const { offerId } = await createOffer(userAccessToken, offer);

  // Step 3: Publish the listing
  const { listingId, itemWebUrl } = await publishOffer(userAccessToken, offerId);

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