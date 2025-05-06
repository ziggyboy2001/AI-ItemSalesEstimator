interface SearchResult {
  title: string;
  price: number | string;
  image?: string;
  condition?: string;
  timestamp: string;
  query: string;
  url?: string;
  hotness?: string;
  sellerInfo?: string;
  topRatedSeller?: boolean;
  [key: string]: any;
}

interface SearchStats {
  averagePrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  totalItems: number;
  topRatedSellers: number;
  averageSellerRating: number;
  conditionBreakdown: Record<string, number>;
  itemsSold: number;
}

export function calculateSearchStats(items: SearchResult[]): SearchStats {
  const stats: SearchStats = {
    averagePrice: 0,
    priceRange: { min: Infinity, max: -Infinity },
    totalItems: items.length,
    topRatedSellers: 0,
    averageSellerRating: 0,
    conditionBreakdown: {},
    itemsSold: 0
  };

  let totalPrice = 0;
  let validPrices = 0;
  let totalSellerRatings = 0;
  let ratedSellers = 0;

  items.forEach(item => {
    // Calculate price statistics
    const price = typeof item.price === 'string' 
      ? parseFloat(item.price.replace(/[^0-9.]/g, '')) 
      : item.price;
    
    if (price > 0) {
      totalPrice += price;
      validPrices++;
      stats.priceRange.min = Math.min(stats.priceRange.min, price);
      stats.priceRange.max = Math.max(stats.priceRange.max, price);
    }

    // Count top rated sellers
    if (item.topRatedSeller) {
      stats.topRatedSellers++;
    }

    // Calculate seller ratings
    const ratingMatch = item.sellerInfo?.match(/\((\d+)\)\s+(\d+\.\d+)%/);
    if (ratingMatch) {
      const rating = parseFloat(ratingMatch[2]);
      totalSellerRatings += rating;
      ratedSellers++;
    }

    // Count items by condition
    const condition = item.condition || 'Unknown';
    stats.conditionBreakdown[condition] = (stats.conditionBreakdown[condition] || 0) + 1;

    // Count items sold
    const soldMatch = item.hotness?.match(/(\d+)\+\s+sold/);
    if (soldMatch) {
      stats.itemsSold += parseInt(soldMatch[1], 10);
    } else {
      // If no hotness data, count the item as 1 sold
      stats.itemsSold += 1;
    }
  });

  // Calculate averages
  stats.averagePrice = validPrices > 0 ? totalPrice / validPrices : 0;
  stats.averageSellerRating = ratedSellers > 0 ? totalSellerRatings / ratedSellers : 0;

  return stats;
} 