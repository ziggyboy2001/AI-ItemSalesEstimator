// Old eBay API logic removed. Use services/ebayCompletedApi.ts for new API integration.

import { Buffer } from 'buffer';
import { OPENAI_API_KEY, EBAY_CLIENT_ID, EBAY_CLIENT_SECRET } from '@env';

// Update URLs to use production endpoints
const EBAY_API_URL = 'https://api.ebay.com/buy/browse/v1';
const EBAY_AUTH_URL = 'https://api.ebay.com/identity/v1/oauth2/token';

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
      throw new EbayError(
        EbayErrorType.NETWORK_ERROR,
        'Request timed out after ' + (timeout/1000) + ' seconds',
        undefined,
        error
      );
    }
    throw error;
  }
};

// Error types for better error handling
export enum EbayErrorType {
  AUTH_FAILED = 'AUTH_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_IMAGE = 'INVALID_IMAGE',
  NO_RESULTS = 'NO_RESULTS',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN'
}

export class EbayError extends Error {
  type: EbayErrorType;
  statusCode?: number;
  rawError?: any;

  constructor(type: EbayErrorType, message: string, statusCode?: number, rawError?: any) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
    this.rawError = rawError;
    this.name = 'EbayError';
  }
}

interface EbayAuthToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface EbayImageSearchRequest {
  image: string; // Base64 encoded image
  category_ids?: string[];
  limit?: number;
  offset?: number;
}

// Updated interface to match actual eBay API response
export interface EbayImageSearchResponse {
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

async function getEbayAuthToken(): Promise<string> {
  console.log('🔑 Getting eBay auth token...');
  try {
    const credentials = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64');
    
    console.log('Making auth request to eBay production...');
    console.log('Using Client ID:', EBAY_CLIENT_ID.substring(0, 10) + '...');
    
    const authBody = 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope';
    console.log('Auth request body:', authBody);
    
    const response = await fetchWithTimeout(EBAY_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: authBody
    }, 10000); // 10 second timeout

    console.log(`Auth response status: ${response.status}`);
    console.log('Auth response headers:', response.headers);
    
    const responseText = await response.text();
    console.log('Raw auth response:', responseText);
    
    if (!response.ok) {
      console.error('eBay auth error response:', responseText);
      
      if (response.status === 401) {
        throw new EbayError(
          EbayErrorType.AUTH_FAILED,
          'Invalid eBay credentials - check Client ID and Secret',
          response.status,
          responseText
        );
      }
      
      throw new EbayError(
        EbayErrorType.UNKNOWN,
        `eBay auth error: ${responseText}`,
        response.status,
        responseText
      );
    }

    let data: EbayAuthToken;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse auth response:', parseError);
      throw new EbayError(
        EbayErrorType.UNKNOWN,
        'Invalid JSON response from eBay auth',
        response.status,
        responseText
      );
    }

    if (!data.access_token) {
      console.error('No access token in response:', data);
      throw new EbayError(
        EbayErrorType.AUTH_FAILED,
        'No access token received from eBay',
        response.status,
        data
      );
    }

    console.log('✅ Successfully got eBay auth token');
    return data.access_token;
  } catch (error) {
    if (error instanceof EbayError) {
      throw error;
    }
    
    console.error('Unexpected error getting eBay auth token:', error);
    throw new EbayError(
      EbayErrorType.NETWORK_ERROR,
      'Failed to authenticate with eBay: ' + (error instanceof Error ? error.message : String(error)),
      undefined,
      error
    );
  }
}

function validateImageData(image: string): void {
  console.log('Validating image data...');
  if (!image) {
    throw new EbayError(
      EbayErrorType.INVALID_IMAGE,
      'No image data provided'
    );
  }
  
  try {
    const decoded = Buffer.from(image, 'base64');
    if (decoded.length > 5 * 1024 * 1024) { // 5MB limit
      throw new EbayError(
        EbayErrorType.INVALID_IMAGE,
        'Image size exceeds 5MB limit'
      );
    }
    console.log(`Image size: ${(decoded.length / 1024 / 1024).toFixed(2)}MB`);
  } catch (error) {
    if (error instanceof EbayError) throw error;
    throw new EbayError(
      EbayErrorType.INVALID_IMAGE,
      'Invalid base64 image data'
    );
  }
}

export async function searchByImage(request: EbayImageSearchRequest): Promise<EbayImageSearchResponse> {
  console.log('🔍 Starting eBay production image search...');
  console.log('Request params:', {
    categoryIds: request.category_ids,
    limit: request.limit,
    offset: request.offset,
    imageSize: request.image ? Math.round(request.image.length / 1024) + 'KB' : 'none'
  });

  try {
    // Validate image data
    validateImageData(request.image);

    // Get auth token
    console.log('Requesting eBay auth token...');
    const token = await getEbayAuthToken();
    console.log('✅ Got auth token, making image search request...');
    
    const searchBody = JSON.stringify({
      image: request.image,
      category_ids: request.category_ids,
      limit: request.limit || 50,
      offset: request.offset || 0
    });
    
    console.log('Making image search request to:', `${EBAY_API_URL}/item_summary/search_by_image`);
    console.log('Request headers:', {
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Authorization': 'Bearer [REDACTED]'
    });
    
    const response = await fetchWithTimeout(`${EBAY_API_URL}/item_summary/search_by_image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      },
      body: searchBody
    }, 30000); // 30 second timeout for image search

    console.log(`Search response status: ${response.status}`);
    console.log('Search response headers:', response.headers);

    const responseText = await response.text();
    console.log('Raw search response:', responseText);

    if (!response.ok) {
      console.error('eBay search error response:', responseText);

      // Handle specific error cases
      switch (response.status) {
        case 401:
          throw new EbayError(
            EbayErrorType.AUTH_FAILED,
            'Authentication failed - token may have expired',
            response.status,
            responseText
          );
        case 429:
          throw new EbayError(
            EbayErrorType.RATE_LIMIT,
            'Rate limit exceeded - try again in a few minutes',
            response.status,
            responseText
          );
        case 500:
        case 502:
        case 503:
        case 504:
          throw new EbayError(
            EbayErrorType.SERVER_ERROR,
            'eBay server error - try again later',
            response.status,
            responseText
          );
        default:
          throw new EbayError(
            EbayErrorType.UNKNOWN,
            `eBay search error: ${responseText}`,
            response.status,
            responseText
          );
      }
    }

    let data: EbayImageSearchResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse search response:', parseError);
      throw new EbayError(
        EbayErrorType.UNKNOWN,
        'Invalid JSON response from eBay search',
        response.status,
        responseText
      );
    }

    console.log('Search results:', {
      totalItems: data.total,
      returnedItems: data.itemSummaries?.length || 0,
      limit: data.limit,
      offset: data.offset
    });

    if (!data.itemSummaries || data.itemSummaries.length === 0) {
      throw new EbayError(
        EbayErrorType.NO_RESULTS,
        'No items found matching this image'
      );
    }

    console.log('✅ Successfully completed image search');
    return data;
  } catch (error) {
    if (error instanceof EbayError) {
      throw error;
    }
    
    console.error('Unexpected error in image search:', error);
    throw new EbayError(
      EbayErrorType.NETWORK_ERROR,
      'Failed to search by image: ' + (error instanceof Error ? error.message : String(error)),
      undefined,
      error
    );
  }
}

// Helper function to calculate stats from eBay image search results
export function calculateEbayImageSearchStats(response: EbayImageSearchResponse, query: string = 'Image Search') {
  if (!response.itemSummaries || response.itemSummaries.length === 0) {
    return null;
  }

  const items = response.itemSummaries;
  
  // Extract prices (handle both current bid and buy-it-now prices)
  const prices: number[] = items.map(item => {
    if (item.currentBidPrice) {
      return parseFloat(item.currentBidPrice.value);
    }
    return parseFloat(item.price.value);
  }).filter(price => !isNaN(price) && price > 0);

  if (prices.length === 0) {
    return null;
  }

  // Calculate basic stats
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const min_price = Math.min(...prices);
  const max_price = Math.max(...prices);
  const average_price = prices.reduce((a, b) => a + b, 0) / prices.length;
  const median_price = sortedPrices[Math.floor(sortedPrices.length / 2)];
  
  // Standard deviation for outlier detection
  const variance = prices.reduce((a, b) => a + Math.pow(b - average_price, 2), 0) / prices.length;
  const stddev = Math.sqrt(variance);

  // Market activity based on total results
  let market_activity = 'Low';
  if (response.total > 100) market_activity = 'High';
  else if (response.total > 50) market_activity = 'Medium';

  // Match quality based on number of results and price consistency
  const priceConsistency = stddev / average_price; // Lower is more consistent
  let match_quality = Math.round(
    Math.min(100, Math.max(10, 
      (response.total / 10) * 10 + // More results = better match
      (1 - Math.min(1, priceConsistency)) * 50 // Price consistency
    ))
  );

  // Resaleability score based on market activity and price range
  let resaleability_score = Math.round(
    Math.min(99, Math.max(1,
      (response.total / 20) * 30 + // Market depth
      (1 - Math.min(1, priceConsistency)) * 40 + // Price stability
      Math.min(29, response.itemSummaries.length) // Number of current listings
    ))
  );

  return {
    average_price,
    median_price,
    min_price,
    max_price,
    results: response.total,
    returned_items: response.itemSummaries.length,
    strategy_used: 'ebay_image_search',
    original_term: query,
    source: 'eBay Image Search',
    data_source: 'ebay_current_listings',
    market_activity,
    match_quality,
    resaleability_score,
    price_consistency: Math.round((1 - priceConsistency) * 100), // Higher is more consistent
    dominant_category: response.refinement?.dominantCategoryId,
    category_breakdown: response.refinement?.categoryDistributions?.slice(0, 5).map(cat => ({
      name: cat.categoryName,
      count: cat.matchCount
    })),
    condition_breakdown: response.refinement?.conditionDistributions?.slice(0, 5).map(cond => ({
      condition: cond.condition,
      count: cond.matchCount
    }))
  };
}

// Simple OpenAI title simplification for better search results
async function simplifyTitleWithAI(title: string): Promise<string> {
  if (!title || !OPENAI_API_KEY) return title;
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cheapest model
        messages: [
          {
            role: 'user',
            content: `Simplify this product title for search: "${title}"\n\nReturn only the essential product name (brand + main item) in 2-5 words.`
          }
        ],
        max_tokens: 20, // Keep very short to minimize cost
        temperature: 0, // Consistent results
      }),
    });

    if (!response.ok) {
      console.error('OpenAI simplification failed:', response.status);
      return title; // Fallback to original
    }

    const data = await response.json();
    const simplified = data.choices?.[0]?.message?.content?.trim();
    
    if (simplified && simplified.length > 0 && simplified.length < title.length) {
      console.log('🤖 AI simplified:', title, '→', simplified);
      return simplified;
    }
    
    return title; // Fallback if no improvement
  } catch (error) {
    console.error('Title simplification error:', error);
    return title; // Always fallback to original
  }
}

// Updated helper function that uses AI if available, falls back to rules
export async function simplifyItemTitle(title: string): Promise<string> {
  if (!title) return title;
  
  // Try AI first for best results
  const aiSimplified = await simplifyTitleWithAI(title);
  if (aiSimplified !== title) {
    return aiSimplified;
  }
  
  // Fallback to rule-based if AI fails or unavailable
  let simplified = title;
  
  // Convert to title case for consistency
  simplified = simplified.toLowerCase();
  
  // Remove common measurements and specifications
  simplified = simplified.replace(/\b\d+(\.\d+)?\s*(oz|ml|cm|mm|inch|inches|in|ft|feet|lbs?|kg|g|grams?|ounces?|pounds?|pint|pints|quart|quarts|gallon|gallons|cup|cups)\b/gi, '');
  
  // Remove dimensions (e.g., "12 x 8 x 4", "5.5" x 3"")
  simplified = simplified.replace(/\b\d+(\.\d+)?\s*[x×]\s*\d+(\.\d+)?(\s*[x×]\s*\d+(\.\d+)?)?\s*(in|inch|inches|cm|mm)?\b/gi, '');
  
  // Remove quantities and sets (keep brand but remove quantity)
  simplified = simplified.replace(/\b(set of|pack of|lot of|case of|box of)\s*\d+\b/gi, 'set');
  simplified = simplified.replace(/\b\d+\s*(piece|pc|pcs|pieces?|count|pk|pack)\b/gi, '');
  
  // Remove marketing/condition terms
  const marketingTerms = [
    'brand new', 'new', 'used', 'pre-owned', 'vintage', 'antique', 'rare', 'limited edition',
    'premium', 'deluxe', 'professional', 'commercial grade', 'heavy duty', 'high quality',
    'authentic', 'genuine', 'original', 'replacement', 'compatible', 'universal',
    'never used', 'mint condition', 'like new', 'excellent condition', 'good condition',
    'working', 'tested', 'guaranteed', 'warranty', 'certified', 'approved',
    'fast shipping', 'free shipping', 'same day shipping', 'priority shipping'
  ];
  
  marketingTerms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    simplified = simplified.replace(regex, '');
  });
  
  // Remove year ranges and model years (but keep if it's part of model name)
  simplified = simplified.replace(/\b(19|20)\d{2}(-|\s+to\s+|(19|20)\d{2})?\b/g, '');
  
  // Remove common filler words
  const fillerWords = [
    'for', 'with', 'and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'by', 'of',
    'very', 'super', 'extra', 'special', 'amazing', 'perfect', 'great', 'best',
    'top', 'quality', 'style', 'design', 'beautiful', 'stunning', 'gorgeous',
    'must have', 'hot item', 'popular', 'trending', 'classic', 'modern'
  ];
  
  // Only remove filler words if they're not essential to the product identity
  fillerWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b(?!\\s+(brand|model|series|collection))`, 'gi');
    simplified = simplified.replace(regex, ' ');
  });
  
  // Remove excessive punctuation and clean up
  simplified = simplified.replace(/[!@#$%^&*()_+=\[\]{}|\\:";'<>?,.]+/g, ' ');
  simplified = simplified.replace(/\s+/g, ' '); // Multiple spaces to single
  simplified = simplified.trim();
  
  // Capitalize first letter of each word
  simplified = simplified.replace(/\b\w/g, letter => letter.toUpperCase());
  
  // If we stripped too much, return a fallback
  if (simplified.length < 10 && title.length > 20) {
    // Take first few meaningful words from original
    const words = title.split(/\s+/).slice(0, 4);
    simplified = words.join(' ');
  }
  
  return simplified;
}

export {};