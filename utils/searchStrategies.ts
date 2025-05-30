import type { EbayCompletedRequest } from '@/services/ebayCompletedApi';
import { fetchEbayCompletedItems } from '@/services/ebayCompletedApi';
import { inferEbayRequestFields } from '@/utils/gptEbayRequestInference';
import { simpleAIWebSearch } from '@/services/aiWebSearch';
import { searchWebWithOpenAI, searchWebWithChatGPT } from '@/services/aiWebSearch';

export interface SearchStrategy {
  name: string;
  searchTerm: string;
  filters?: Partial<EbayCompletedRequest>;
  useAIWebSearch?: boolean;
}

/**
 * Generates multiple search strategies from a base search term
 */
export function generateSearchStrategies(originalTerm: string): SearchStrategy[] {
  const strategies: SearchStrategy[] = [];
  
  // Strategy 1: Original term
  strategies.push({
    name: 'exact',
    searchTerm: originalTerm,
  });

  // Strategy 2: Extract primary keyword (first word)
  const primaryKeyword = originalTerm.split(' ')[0];
  if (primaryKeyword !== originalTerm) {
    strategies.push({
      name: 'primary_keyword',
      searchTerm: primaryKeyword,
    });
  }

  // Strategy 3: Remove common descriptors
  const cleanedTerm = originalTerm
    .replace(/\b(vintage|antique|rare|collectible|new|used|refurbished)\b/gi, '')
    .replace(/\b(black|white|red|blue|green|yellow|silver|gold|gray|grey)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleanedTerm && cleanedTerm !== originalTerm && cleanedTerm !== primaryKeyword) {
    strategies.push({
      name: 'cleaned',
      searchTerm: cleanedTerm,
    });
  }

  // Strategy 4: Broader category terms
  const broaderTerms = generateBroaderTerms(originalTerm);
  broaderTerms.forEach((term, index) => {
    strategies.push({
      name: `broader_${index + 1}`,
      searchTerm: term,
    });
  });

  // Strategy 5: With less restrictive filters
  strategies.push({
    name: 'less_restrictive',
    searchTerm: originalTerm,
    filters: {
      remove_outliers: 'false',
      max_search_results: '300',
    },
  });

  return strategies;
}

/**
 * Attempts to find broader, more generic terms for the search
 */
function generateBroaderTerms(term: string): string[] {
  const broader: string[] = [];
  const lowerTerm = term.toLowerCase();

  // Pokémon-specific expansions
  if (lowerTerm.includes('pokemon') || lowerTerm.includes('pokémon')) {
    // Extract specific set names and characters
    if (lowerTerm.includes('scarlet') || lowerTerm.includes('violet')) {
      broader.push('Pokemon Scarlet Violet');
      broader.push('Pokemon SV');
    }
    if (lowerTerm.includes('miraidon')) {
      broader.push('Pokemon Miraidon');
      broader.push('Pokemon Scarlet Violet Miraidon');
    }
    if (lowerTerm.includes('koraidon')) {
      broader.push('Pokemon Koraidon');
      broader.push('Pokemon Scarlet Violet Koraidon');
    }
    if (lowerTerm.includes('elite trainer box') || lowerTerm.includes('etb')) {
      broader.push('Pokemon Elite Trainer Box');
      broader.push('Pokemon ETB');
    }
    if (lowerTerm.includes('booster box')) {
      broader.push('Pokemon Booster Box');
    }
  }

  // Electronics
  if (lowerTerm.includes('iphone') || lowerTerm.includes('samsung') || lowerTerm.includes('pixel')) {
    broader.push('smartphone');
  }
  if (lowerTerm.includes('ipad') || lowerTerm.includes('tablet')) {
    broader.push('tablet');
  }
  if (lowerTerm.includes('macbook') || lowerTerm.includes('laptop')) {
    broader.push('laptop');
  }
  if (lowerTerm.includes('airpods') || lowerTerm.includes('earbuds')) {
    broader.push('wireless earbuds');
  }

  // Gaming
  if (lowerTerm.includes('playstation') || lowerTerm.includes('ps5') || lowerTerm.includes('ps4')) {
    broader.push('gaming console');
  }
  if (lowerTerm.includes('xbox')) {
    broader.push('gaming console');
  }
  if (lowerTerm.includes('nintendo')) {
    broader.push('gaming console');
  }

  // Clothing
  if (lowerTerm.includes('nike') || lowerTerm.includes('adidas') || lowerTerm.includes('jordan')) {
    broader.push('sneakers');
  }
  if (lowerTerm.includes('shoes') || lowerTerm.includes('sneakers')) {
    broader.push('shoes');
  }

  // Collectibles
  if (lowerTerm.includes('pokemon') || lowerTerm.includes('trading card')) {
    broader.push('trading cards');
  }
  if (lowerTerm.includes('funko') || lowerTerm.includes('pop')) {
    broader.push('collectible figures');
  }

  // Home items
  if (lowerTerm.includes('lamp') || lowerTerm.includes('light')) {
    broader.push('lighting');
  }
  if (lowerTerm.includes('chair') || lowerTerm.includes('stool')) {
    broader.push('furniture');
  }

  return broader.filter(b => b !== lowerTerm);
}

/**
 * Progressively tries different search strategies until results are found
 * Now includes AI web search as a fallback
 */
export async function progressiveSearch(originalTerm: string): Promise<{
  success: boolean;
  results: any[];
  strategy: SearchStrategy;
  stats: any;
  error?: string;
  source?: 'ebay' | 'ai_web_search';
}> {
  const strategies = generateSearchStrategies(originalTerm);
  
  // Add AI Web Search fallback strategy
  strategies.push({
    name: 'ai_web_search',
    searchTerm: originalTerm,
    useAIWebSearch: true,
  });
  
  console.log('Trying search strategies:', strategies.map(s => s.name));

  for (const strategy of strategies) {
    try {
      console.log(`Trying strategy "${strategy.name}" with term: "${strategy.searchTerm}"`);
      
      if (strategy.useAIWebSearch) {
        // Use AI Web Search
        console.log('Trying new OpenAI web search...');
        let aiResult = await searchWebWithOpenAI(strategy.searchTerm);
        
        // Fallback to ChatGPT-style search if Responses API fails
        if (!aiResult.success) {
          console.log('OpenAI Responses API failed, trying ChatGPT-style search...');
          aiResult = await searchWebWithChatGPT(strategy.searchTerm);
        }
        
        // Fallback to old method if new one fails
        if (!aiResult.success) {
          console.log('OpenAI web search failed, trying fallback...');
          aiResult = await simpleAIWebSearch(strategy.searchTerm);
        }
        
        if (aiResult.success && aiResult.products.length > 0) {
          console.log(`AI Web Search found ${aiResult.products.length} results`);
          
          // Convert AI web search results to our expected format
          const convertedItems = aiResult.products.map(product => ({
            item_id: product.link || `ai-${Date.now()}-${Math.random()}`,
            title: product.title,
            sale_price: product.price || 0,
            image_url: undefined, // Don't use AI search images as they're often missing/broken
            condition: product.condition || 'Unknown',
            date_sold: new Date().toISOString(),
            link: product.link,
            buying_format: 'Store Listing',
            shipping_price: 0,
            source_website: product.source, // Preserve the source website
          }));
          
          // Create stats from AI web search results - use actual product prices
          const prices = aiResult.products.map(p => p.price).filter(p => p > 0);
          const stats = {
            average_price: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
            median_price: prices.length > 0 ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)] : 0,
            min_price: prices.length > 0 ? Math.min(...prices) : 0,
            max_price: prices.length > 0 ? Math.max(...prices) : 0,
            results: aiResult.products.length,
            strategy_used: strategy.name,
            original_term: originalTerm,
            source: 'AI Web Search',
            market_summary: aiResult.summary,
            data_source: 'ai_web_search',
            resaleability_score: 0, // Not applicable for AI search
            match_quality: 0, // Not applicable for AI search
            market_activity: aiResult.products.length > 10 ? 'High' : aiResult.products.length > 3 ? 'Medium' : 'Low',
          };
          
          return {
            success: true,
            results: convertedItems,
            strategy,
            stats,
            source: 'ai_web_search',
          };
        } else {
          console.log(`AI Web Search found no results: ${aiResult.summary}`);
        }
      } else {
        // Use eBay search
        const ebayRequest = await inferEbayRequestFields(strategy.searchTerm);
        
        // Apply strategy-specific filters
        if (strategy.filters) {
          Object.assign(ebayRequest, strategy.filters);
        }
        
        const data = await fetchEbayCompletedItems(ebayRequest);
        
        if (data.items && data.items.length > 0) {
          console.log(`Strategy "${strategy.name}" found ${data.items.length} results`);
          return {
            success: true,
            results: data.items,
            strategy,
            stats: {
              average_price: data.average_price,
              median_price: data.median_price,
              min_price: data.min_price,
              max_price: data.max_price,
              results: data.results,
              total_results: data.total_results,
              strategy_used: strategy.name,
              original_term: originalTerm,
            },
            source: 'ebay',
          };
        } else {
          console.log(`Strategy "${strategy.name}" found no results`);
        }
      }
    } catch (error) {
      console.error(`Strategy "${strategy.name}" failed:`, error);
      continue;
    }
  }

  return {
    success: false,
    results: [],
    strategy: strategies[0],
    error: 'No results found with any search strategy',
    stats: null,
  };
} 