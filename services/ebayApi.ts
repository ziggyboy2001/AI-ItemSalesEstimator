import axios from 'axios';

// API configuration
const API_HOST = 'ebay-search-api.p.rapidapi.com';
const API_KEY = '10903221a1mshedd4a7be9ba548bp12f649jsn66278f1d8a80';

interface EbayItem {
  title: string;
  subTitles?: string[];
  price: {
    current: {
      from: string;
      to: string;
    };
    trendingPrice: string | null;
    previousPrice: string;
  };
  soldDate: string;
  hotness: string;
  customerReviews: {
    review: string;
    count: number;
    link: string;
  };
  shippingMessage: string;
  image: string;
  url: string;
  location: string;
}

interface SearchResult {
  itemId: string;
  title: string;
  price: number | string;
  image?: string;
  condition?: string;
  timestamp: string;
  query: string;
  url?: string;
  [key: string]: any;
}

// Search for eBay items
export const searchEbayItems = async (query: string): Promise<SearchResult[]> => {
  try {
    // Properly encode the query for the eBay URL
    const encodedQuery = encodeURIComponent(query);
    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}`;
    const encodedEbayUrl = encodeURIComponent(ebayUrl);

    const response = await axios.get(`https://${API_HOST}/search_get.php`, {
      params: {
        url: encodedEbayUrl
      },
      headers: {
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': API_HOST
      }
    });

    // The API response structure is: { body: { products: [...] } }
    if (response.data && response.data.body && Array.isArray(response.data.body.products)) {
      return response.data.body.products.map((item: EbayItem) => ({
        itemId: item.url?.split('/itm/')[1]?.split('?')[0] || Date.now().toString(),
        title: item.title,
        price: item.price?.current?.from || item.price?.current?.to || 'N/A',
        image: item.image,
        condition: item.subTitles?.join(', ') || null,
        timestamp: new Date().toISOString(),
        query: query,
        url: item.url
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching eBay items:', error);
    throw error;
  }
};

// Get similar items (this is a mock implementation)
export const getSimilarItems = async (title: string) => {
  try {
    // In a real app, we would query the API for similar items
    // For this demo, we'll search for related items based on keywords from the title
    const keywords = title
      .split(' ')
      .filter(word => word.length > 3)
      .slice(0, 3)
      .join(' ');
      
    const response = await searchEbayItems(keywords);
    return response.slice(0, 10); // Return up to 10 similar items
  } catch (error) {
    console.error('Error fetching similar items:', error);
    return []; // Return empty array on error
  }
};

// Calculate estimated resale value based on similar items
export const calculateResaleEstimate = (item: any, similarItems: any[]) => {
  if (!similarItems || similarItems.length === 0) {
    return null;
  }

  const itemPrice = typeof item.price === 'string' 
    ? parseFloat(item.price.replace(/[^0-9.]/g, '')) 
    : item.price;

  const validPrices = similarItems
    .map(similarItem => {
      const price = typeof similarItem.price === 'string'
        ? parseFloat(similarItem.price.replace(/[^0-9.]/g, ''))
        : similarItem.price;
      return isNaN(price) ? null : price;
    })
    .filter(price => price !== null) as number[];

  if (validPrices.length === 0) {
    return null;
  }

  // Calculate average, min, and max
  const sum = validPrices.reduce((acc, price) => acc + price, 0);
  const avg = sum / validPrices.length;
  const min = Math.min(...validPrices);
  const max = Math.max(...validPrices);
  
  // Calculate estimate based on condition
  let conditionFactor = 1.0;
  const condition = item.condition?.toLowerCase() || '';
  
  if (condition.includes('new') || condition.includes('unused')) {
    conditionFactor = 0.9; // 90% of original for new items
  } else if (condition.includes('like new') || condition.includes('excellent')) {
    conditionFactor = 0.8; // 80% for like new
  } else if (condition.includes('good')) {
    conditionFactor = 0.7; // 70% for good condition
  } else if (condition.includes('acceptable') || condition.includes('fair')) {
    conditionFactor = 0.5; // 50% for acceptable condition
  } else if (condition.includes('for parts') || condition.includes('not working')) {
    conditionFactor = 0.3; // 30% for parts/not working
  }
  
  const estimatedValue = itemPrice ? 
    (itemPrice * conditionFactor) : 
    (avg * conditionFactor);

  return {
    estimate: estimatedValue,
    formattedEstimate: `$${estimatedValue.toFixed(2)}`,
    min: min * conditionFactor,
    formattedMin: `$${(min * conditionFactor).toFixed(2)}`,
    max: max * conditionFactor,
    formattedMax: `$${(max * conditionFactor).toFixed(2)}`,
    similarItemsCount: validPrices.length,
    conditionFactor
  };
};