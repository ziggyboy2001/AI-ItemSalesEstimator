import { Buffer } from 'buffer';

// eBay API URLs (Production)
const EBAY_API_URL = 'https://api.ebay.com/buy/browse/v1';
const EBAY_AUTH_URL = 'https://api.ebay.com/identity/v1/oauth2/token';

// Production credentials from environment
const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID || 'KeithZah-bidpeek-PRD-9efff03ae-f2d8c8c1';
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET || 'PRD-efff03ae1b85-75a1-442e-8910-1b22';

// Error types for better error handling
export enum EbayBrowseErrorType {
  AUTH_FAILED = 'AUTH_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  NO_RESULTS = 'NO_RESULTS',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN'
}

export class EbayBrowseError extends Error {
  type: EbayBrowseErrorType;
  statusCode?: number;
  rawError?: any;

  constructor(type: EbayBrowseErrorType, message: string, statusCode?: number, rawError?: any) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
    this.rawError = rawError;
    this.name = 'EbayBrowseError';
  }
}

interface EbayAuthToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface EbayTextSearchRequest {
  q: string; // Search query
  category_ids?: string;
  filter?: string; // e.g., "price:[10..50],condition:{New|Used}"
  sort?: string; // e.g., "price", "-price", "distance", "newlyListed"
  limit?: number; // Max 200
  offset?: number;
  fieldgroups?: string; // e.g., "MATCHING_ITEMS,FULL"
  aspect_filter?: string;
  charity_ids?: string;
}

// Interface matching eBay Browse API response structure
export interface EbayTextSearchResponse {
  href?: string;
  total: number;
  limit: number;
  offset: number;
  next?: string;
  prev?: string;
  itemSummaries: {
    itemId: string;
    title: string;
    price: {
      value: string;
      currency: string;
      convertedFromCurrency?: string;
      convertedFromValue?: string;
    };
    image?: {
      imageUrl: string;
      height?: number;
      width?: number;
    };
    additionalImages?: Array<{
      imageUrl: string;
      height?: number;
      width?: number;
    }>;
    condition?: string;
    conditionId?: string;
    itemWebUrl: string;
    itemAffiliateWebUrl?: string;
    categories?: Array<{
      categoryId: string;
      categoryName: string;
    }>;
    seller?: {
      username: string;
      feedbackPercentage?: string;
      feedbackScore?: number;
    };
    shippingOptions?: Array<{
      shippingCost?: {
        value: string;
        currency: string;
      };
      shippingCostType?: string;
    }>;
    buyingOptions?: string[];
    currentBidPrice?: {
      value: string;
      currency: string;
    };
    bidCount?: number;
    marketingPrice?: {
      originalPrice?: {
        value: string;
        currency: string;
      };
      discountPercentage?: string;
    };
    thumbnailImages?: Array<{
      imageUrl: string;
    }>;
    itemLocation?: {
      postalCode: string;
      country: string;
    };
    topRatedBuyingExperience?: boolean;
    itemOriginDate?: string;
    itemCreationDate?: string;
    legacyItemId?: string;
    epid?: string;
    itemHref?: string;
    leafCategoryIds?: string[];
    adultOnly?: boolean;
    availableCoupons?: boolean;
    priorityListing?: boolean;
    listingMarketplaceId?: string;
    pickupOptions?: Array<{
      pickupLocationType: string;
    }>;
    itemGroupHref?: string;
    itemGroupType?: string;
  }[];
  refinement?: {
    aspectDistributions?: Array<{
      localizedAspectName: string;
      aspectValueDistributions: Array<{
        localizedAspectValue: string;
        matchCount: number;
        refinementHref: string;
      }>;
    }>;
    categoryDistributions?: Array<{
      categoryId: string;
      categoryName: string;
      matchCount: number;
      refinementHref: string;
    }>;
    conditionDistributions?: Array<{
      condition: string;
      conditionId: string;
      matchCount: number;
      refinementHref: string;
    }>;
    dominantCategoryId?: string;
  };
  warnings?: Array<{
    category: string;
    domain: string;
    errorId: number;
    message: string;
    longMessage: string;
  }>;
}

// Add fetch timeout helper
const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 30000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new EbayBrowseError(
        EbayBrowseErrorType.NETWORK_ERROR,
        'Request timed out after ' + (timeout/1000) + ' seconds',
        undefined,
        error
      );
    }
    throw error;
  }
};

async function getEbayAuthToken(): Promise<string> {
  console.log('🔑 Getting eBay auth token for Browse API...');
  try {
    const credentials = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64');
    
    console.log('Making auth request to eBay production...');
    const response = await fetchWithTimeout(EBAY_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    }, 15000);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('eBay auth error response:', errorText);
      throw new EbayBrowseError(
        EbayBrowseErrorType.AUTH_FAILED,
        `eBay authentication failed: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const token: EbayAuthToken = await response.json();
    console.log('✅ eBay auth token obtained successfully');
    return token.access_token;
  } catch (error: any) {
    if (error instanceof EbayBrowseError) throw error;
    
    console.error('❌ eBay auth error:', error);
    throw new EbayBrowseError(
      EbayBrowseErrorType.AUTH_FAILED,
      `Failed to get eBay auth token: ${error.message}`,
      undefined,
      error
    );
  }
}

export async function searchEbayListings(request: EbayTextSearchRequest): Promise<EbayTextSearchResponse> {
  console.log('🔍 Searching eBay current listings with Browse API...', { query: request.q, limit: request.limit });
  
  try {
    const token = await getEbayAuthToken();
    
    // Build query parameters
    const params = new URLSearchParams();
    
    // Required parameter
    params.append('q', request.q);
    
    // Optional parameters with defaults
    if (request.category_ids) {
      params.append('category_ids', request.category_ids);
    }
    
    if (request.filter) {
      params.append('filter', request.filter);
    }
    
    // Default to sort by newly listed to get current active listings
    params.append('sort', request.sort || 'newlyListed');
    
    // Default limit to 50, max 200 according to eBay API docs
    params.append('limit', String(Math.min(request.limit || 50, 200)));
    
    if (request.offset) {
      params.append('offset', String(request.offset));
    }
    
    // Get full details including images, seller info, etc.
    params.append('fieldgroups', request.fieldgroups || 'MATCHING_ITEMS');
    
    if (request.aspect_filter) {
      params.append('aspect_filter', request.aspect_filter);
    }
    
    if (request.charity_ids) {
      params.append('charity_ids', request.charity_ids);
    }

    const url = `${EBAY_API_URL}/item_summary/search?${params.toString()}`;
    console.log('📡 Making eBay Browse API request:', url.replace(token, '[TOKEN]'));

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US', // US marketplace
        'Accept': 'application/json',
      },
    }, 30000);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ eBay Browse API error response:', errorText);
      
      if (response.status === 429) {
        throw new EbayBrowseError(
          EbayBrowseErrorType.RATE_LIMIT,
          'eBay API rate limit exceeded. Please try again later.',
          response.status,
          errorText
        );
      } else if (response.status >= 500) {
        throw new EbayBrowseError(
          EbayBrowseErrorType.SERVER_ERROR,
          'eBay server error. Please try again later.',
          response.status,
          errorText
        );
      } else {
        throw new EbayBrowseError(
          EbayBrowseErrorType.UNKNOWN,
          `eBay API request failed: ${response.status} ${response.statusText}`,
          response.status,
          errorText
        );
      }
    }

    const data: EbayTextSearchResponse = await response.json();
    console.log('✅ eBay Browse API response received:', {
      total: data.total,
      returned: data.itemSummaries?.length || 0,
      hasNext: !!data.next
    });

    if (!data.itemSummaries || data.itemSummaries.length === 0) {
      throw new EbayBrowseError(
        EbayBrowseErrorType.NO_RESULTS,
        'No current listings found for this search.',
        200,
        data
      );
    }

    return data;
  } catch (error: any) {
    if (error instanceof EbayBrowseError) throw error;
    
    console.error('❌ eBay Browse API search error:', error);
    throw new EbayBrowseError(
      EbayBrowseErrorType.UNKNOWN,
      `Search failed: ${error.message}`,
      undefined,
      error
    );
  }
}

// Helper function to calculate stats from eBay Browse API response
export function calculateEbayBrowseStats(response: EbayTextSearchResponse, query: string = 'Current Listings'): any {
  const items = response.itemSummaries || [];
  const prices = items
    .map(item => parseFloat(item.price.value))
    .filter(price => !isNaN(price) && price > 0);
  
  if (prices.length === 0) {
    return {
      average_price: 0,
      median_price: 0,
      min_price: 0,
      max_price: 0,
      results: items.length, // Actual number of items returned and displayed
      total_available: response.total, // Total available in eBay's database
      strategy_used: 'ebay_browse_api',
      original_term: query,
      source: 'eBay Current Listings',
      market_summary: `Found ${items.length} current listings for "${query}"${response.total > items.length ? ` (${response.total} total available)` : ''}`,
      data_source: 'ebay_browse',
      resaleability_score: 0,
      match_quality: items.length > 0 ? 85 : 0,
      market_activity: items.length > 20 ? 'High' : items.length > 5 ? 'Medium' : 'Low',
    };
  }

  prices.sort((a, b) => a - b);
  const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const median = prices[Math.floor(prices.length / 2)];
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  // Count different conditions and buying options
  const conditions = items.reduce((acc, item) => {
    const condition = item.condition || 'Unknown';
    acc[condition] = (acc[condition] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const buyingOptions = items.reduce((acc, item) => {
    if (item.buyingOptions) {
      item.buyingOptions.forEach(option => {
        acc[option] = (acc[option] || 0) + 1;
      });
    }
    return acc;
  }, {} as Record<string, number>);

  // Generate market summary
  const topCondition = Object.keys(conditions).reduce((a, b) => conditions[a] > conditions[b] ? a : b, 'Unknown');
  const hasAuctions = 'AUCTION' in buyingOptions;
  const hasBuyNow = 'FIXED_PRICE' in buyingOptions;
  const hasBestOffer = 'BEST_OFFER' in buyingOptions;

  let marketSummary = `Found ${items.length} current listings for "${query}"`;
  
  // Add total available info if we're showing a subset
  if (response.total > items.length) {
    marketSummary += ` (${response.total} total available)`;
  }
  
  marketSummary += `. Most items are ${topCondition.toLowerCase()}. `;
  marketSummary += `Price range: $${min.toFixed(2)} - $${max.toFixed(2)}. `;
  
  if (hasBuyNow && hasAuctions) {
    marketSummary += 'Mix of Buy Now and auction listings available.';
  } else if (hasBuyNow) {
    marketSummary += 'Mostly Buy Now listings available.';
  } else if (hasAuctions) {
    marketSummary += 'Mostly auction listings available.';
  }

  if (hasBestOffer) {
    marketSummary += ' Some sellers accept best offers.';
  }

  return {
    average_price: average,
    median_price: median,
    min_price: min,
    max_price: max,
    results: items.length, // Actual number of items returned and displayed
    total_available: response.total, // Total available in eBay's database
    strategy_used: 'ebay_browse_api',
    original_term: query,
    source: 'eBay Current Listings',
    market_summary: marketSummary,
    data_source: 'ebay_browse',
    resaleability_score: 0, // Not applicable for current listings
    match_quality: items.length > 0 ? Math.min(95, 60 + (items.length * 2)) : 0,
    market_activity: items.length > 20 ? 'High' : items.length > 5 ? 'Medium' : 'Low',
    conditions: conditions,
    buying_options: buyingOptions,
  };
} 