// Old eBay API logic removed. Use services/ebayCompletedApi.ts for new API integration.

import { Buffer } from 'buffer';

// Update URLs to use sandbox endpoints
const EBAY_API_URL = 'https://api.sandbox.ebay.com/buy/browse/v1';
const EBAY_AUTH_URL = 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';

const EBAY_CLIENT_ID = 'KeithZah-bidpeek-SBX-aa6d579f2-l5df5368';
const EBAY_CLIENT_SECRET = 'SBX-a6d579f203c1-a171-4a02-a4aa-6157';

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

export interface EbayImageSearchResponse {
  itemSummaries: {
    itemId: string;
    title: string;
    price: {
      value: string;
      currency: string;
    };
    image: {
      imageUrl: string;
    };
    condition: string;
    itemWebUrl: string;
  }[];
  total: number;
  limit: number;
  offset: number;
}

async function getEbayAuthToken(): Promise<string> {
  console.log('🔑 Getting eBay auth token...');
  try {
    const credentials = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64');
    
    console.log('Making auth request to eBay sandbox...');
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
  console.log('🔍 Starting eBay sandbox image search...');
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

export {};