import { OPENAI_API_KEY, PERPLEXITY_API_KEY } from '@env';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

interface ProductResult {
  title: string;
  price: number;
  source: string;
  link: string;
  image?: string;
  condition?: string;
  availability?: string;
}

interface AIWebSearchResult {
  success: boolean;
  products: ProductResult[];
  query: string;
  summary?: string;
  average_price?: number;
  price_range?: { min: number; max: number };
}

/**
 * Use OpenAI's Vision API to identify a product from an image
 */
export async function identifyProductFromImage(imageBase64: string): Promise<string> {
  try {
    console.log('Identifying product from image...');
    
    const response = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Identify this product and provide a detailed description suitable for searching online marketplaces. Include brand, model, product type, and any identifying features. Be specific and accurate.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 300
      })
    });

    if (!response.ok) {
      throw new Error('Failed to identify product from image');
    }

    const data = await response.json();
    const productDescription = data.choices[0]?.message?.content || '';
    
    console.log('Product identified:', productDescription);
    return productDescription;
    
  } catch (error) {
    console.error('Error identifying product from image:', error);
    throw error;
  }
}

/**
 * Use Perplexity's Sonar API for REAL web search with actual citations
 * 
 * ✅ Perplexity provides genuine web search results with real citations
 * and doesn't fabricate information like OpenAI's web search API.
 */
export async function searchWebWithPerplexity(productQuery: string): Promise<AIWebSearchResult> {
  try {
    console.log('🔍 Starting Perplexity web search for:', productQuery);
    
    // Enhanced search with multiple retailer-specific queries
    const enhancedQuery = `${productQuery} price buy purchase cost "for sale" -review -unboxing`;
    
    // First, get comprehensive research with specific retailer focus
    const researchResponse = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: `You are a specialized shopping assistant. Search for current product listings with specific prices from major retailers. Focus on finding actual product pages with prices, not reviews or general information.

CRITICAL INSTRUCTIONS:
- Search ONLY for actual product listings with prices
- Include specific dollar amounts when found
- Search these retailers explicitly: Amazon, eBay, Walmart, Target, Best Buy, GameStop, B&H Photo, Newegg, TCGPlayer, MercariI, Facebook Marketplace, specialty stores
- Look for different conditions: new, used, refurbished, open box
- Include model numbers and specific variants when possible
- Cite your sources with URLs`
          },
          {
            role: 'user',
            content: `Find current market pricing and buy options for "${productQuery}". 

Search requirements:
1. Find EXACT product listings with specific prices (not just mentions)
2. Search major retailers: Amazon, eBay, Walmart, Target, Best Buy, GameStop, specialty stores
3. Include different conditions and variants
4. Look for multiple sellers and price points
5. Include shipping costs when mentioned
6. Provide direct links to purchase pages
7. Include product images when available

Return detailed results with:
- Exact product titles as listed on retailer sites
- Specific prices (including any shipping)
- Retailer names
- Product conditions
- Availability status
- Direct purchase URLs
- Product image URLs when available`
          }
        ],
        max_tokens: 2000,
        temperature: 0.0
      })
    });

    if (!researchResponse.ok) {
      const errorText = await researchResponse.text();
      console.error('Perplexity research error:', errorText);
      throw new Error(`Perplexity API error: ${researchResponse.status}`);
    }

    const researchData = await researchResponse.json();
    const researchContent = researchData.choices?.[0]?.message?.content;

    if (!researchContent) {
      throw new Error('No research content received from Perplexity');
    }

    console.log('📋 Research content length:', researchContent.length);
    console.log('📋 Research preview:', researchContent.substring(0, 500) + '...');

    // Enhanced parsing with more flexible extraction
    const analysisResponse = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `Extract product listings with pricing from the research content. Be thorough but concise to avoid response truncation.

EXTRACTION RULES:
- Include any product with a price mention
- Extract prices from text like "$X.XX", "costs $X", "priced at $X", "$X dollars", etc.
- If a range is given (e.g. "$50-60"), use the average
- Include shipping costs in the total price when mentioned
- Extract retailer names accurately (Amazon, Walmart, Target, etc.)
- Keep titles concise but descriptive
- Limit to top 15 most relevant products to avoid truncation

Respond with VALID JSON only (no markdown):
{
  "products": [
    {
      "title": "Product Name",
      "price": 99.99,
      "source": "Retailer",
      "link": "URL",
      "image": "image_url_if_available",
      "condition": "New/Used/etc",
      "availability": "In Stock/etc"
    }
  ],
  "search_quality": "Good/Excellent/etc",
  "total_sources": 5
}`
          },
          {
            role: 'user',
            content: `Extract the TOP 15 most relevant product listings for "${productQuery}" from this research. Include a variety of retailers and price points:\n\n${researchContent}`
          }
        ],
        max_tokens: 2500, // Increased to handle more products
        temperature: 0.0
      })
    });

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('Perplexity analysis error:', errorText);
      throw new Error(`Perplexity analysis failed: ${analysisResponse.status}`);
    }

    const analysisData = await analysisResponse.json();
    const analysisContent = analysisData.choices?.[0]?.message?.content;

    if (!analysisContent) {
      throw new Error('No analysis content received');
    }

    console.log('🧮 Analysis content preview:', analysisContent.substring(0, 500) + '...');
    console.log('🧮 Analysis content length:', analysisContent.length);

    // Enhanced JSON parsing with better error handling and repair
    let parsedResults;
    try {
      // First, try to clean and parse the JSON
      let cleanJson = analysisContent.replace(/```json\n?|\n?```/g, '').trim();
      
      // Remove any trailing comma before closing braces/brackets
      cleanJson = cleanJson.replace(/,(\s*[}\]])/g, '$1');
      
      parsedResults = JSON.parse(cleanJson);
      console.log('✅ JSON parsed successfully');
    } catch (parseError) {
      console.error('Initial JSON parsing failed, trying repair strategies...');
      
      // Strategy 1: Extract just the JSON object
      const jsonMatch = analysisContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          let extractedJson = jsonMatch[0];
          // Fix common JSON issues
          extractedJson = extractedJson.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
          extractedJson = extractedJson.replace(/([{,]\s*")([^"]+)("\s*:\s*")([^"]*)(")(?=[,}])/g, '$1$2$3$4$5'); // Basic quote fixing
          
          parsedResults = JSON.parse(extractedJson);
          console.log('✅ JSON repaired and parsed successfully');
        } catch (secondError) {
          console.log('Strategy 1 failed, trying strategy 2...');
          
          // Strategy 2: Try to extract and repair products array
          const productsMatch = analysisContent.match(/"products"\s*:\s*\[[\s\S]*?\]/);
          if (productsMatch) {
            try {
              let productsJson = `{${productsMatch[0]}, "search_quality": "Extracted", "total_sources": "Unknown"}`;
              
              // Fix truncated JSON by closing incomplete objects
              const openBraces = (productsJson.match(/\{/g) || []).length;
              const closeBraces = (productsJson.match(/\}/g) || []).length;
              
              if (openBraces > closeBraces) {
                const missingBraces = openBraces - closeBraces;
                console.log(`Adding ${missingBraces} missing closing braces`);
                productsJson += '}'.repeat(missingBraces);
              }
              
              // Remove trailing comma and fix end
              productsJson = productsJson.replace(/,(\s*\])/, '$1');
              productsJson = productsJson.replace(/,(\s*\})/, '$1');
              
              parsedResults = JSON.parse(productsJson);
              console.log('✅ Products array extracted and repaired successfully');
            } catch (thirdError) {
              console.log('Strategy 2 failed, trying manual extraction...');
              
              // Strategy 3: Manual product extraction as fallback
              const manualProducts = extractProductsManually(analysisContent);
              if (manualProducts.length > 0) {
                parsedResults = {
                  products: manualProducts,
                  search_quality: "Manual extraction",
                  total_sources: manualProducts.length
                };
                console.log(`✅ Manual extraction found ${manualProducts.length} products`);
              } else {
                throw new Error('All JSON parsing and manual extraction strategies failed');
              }
            }
          } else {
            throw new Error('No products array found in response');
          }
        }
      } else {
        throw new Error('No JSON structure found in response');
      }
    }

    const products = Array.isArray(parsedResults.products) ? parsedResults.products : [];
    const searchQuality = parsedResults.search_quality || parsedResults.research_quality || 'Standard';
    const totalSources = parsedResults.total_sources || 'Unknown';

    console.log('📊 Raw products found:', products.length);
    console.log('📊 Products details:', products);

    if (products.length === 0) {
      return {
        success: false,
        products: [],
        query: productQuery,
        summary: `**No current pricing data found**\n\nPerplexity searched the web but couldn't find specific pricing information for "${productQuery}" from major retailers.\n\n**Search Quality:** ${searchQuality}\n**Sources Checked:** ${totalSources}\n\n**Research Preview:** ${researchContent.substring(0, 300)}...\n\n**Suggestion:** Try searching with more specific product details, model numbers, or check individual retailer websites directly.`
      };
    }

    // Enhanced validation with more flexible price handling
    const validProducts = products
      .map((p: any) => {
        // More flexible price extraction
        let price = 0;
        if (typeof p.price === 'number' && p.price > 0) {
          price = p.price;
        } else if (typeof p.price === 'string') {
          // Try to extract price from string
          const priceMatch = p.price.match(/[\d,]+\.?\d*/);
          if (priceMatch) {
            price = parseFloat(priceMatch[0].replace(/,/g, ''));
          }
        }
        
        // Skip if still no valid price
        if (!price || price <= 0) return null;
        
        // Handle image URL
        let imageUrl = undefined;
        if (p.image && typeof p.image === 'string' && p.image.trim() !== '') {
          const trimmedImage = p.image.trim();
          // Basic URL validation
          if (trimmedImage.startsWith('http') || trimmedImage.startsWith('//')) {
            imageUrl = trimmedImage;
          }
        }
        
        return {
          title: String(p.title || 'Unknown Product').trim(),
          price: price,
          source: String(p.source || 'Unknown Retailer').trim(),
          link: String(p.link || '').trim(),
          image: imageUrl,
          condition: String(p.condition || 'Unknown').trim(),
          availability: String(p.availability || 'Check website').trim()
        };
      })
      .filter((p: any) => p !== null); // Remove invalid products

    console.log('📊 Valid products after filtering:', validProducts.length);
    console.log('📊 Valid products details:', validProducts);

    if (validProducts.length === 0) {
      return {
        success: false,
        products: [],
        query: productQuery,
        summary: `**No valid pricing data found**\n\nPerplexity found product mentions but no reliable pricing information could be extracted.\n\n**Search Quality:** ${searchQuality}\n**Sources Checked:** ${totalSources}\n**Raw Results Found:** ${products.length}\n\n**Issue:** Products found but prices could not be validated or were missing.\n\n**Suggestion:** Try searching with more specific product details or check retailer websites directly.`
      };
    }

    // Calculate enhanced statistics
    const prices = validProducts.map((p: ProductResult) => p.price);
    const average_price = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
    const min_price = Math.min(...prices);
    const max_price = Math.max(...prices);
    const median_price = prices.sort((a: number, b: number) => a - b)[Math.floor(prices.length / 2)];

    // Count unique sources
    const uniqueSources = [...new Set(validProducts.map((p: ProductResult) => p.source))];

    // Enhanced success summary
    const summary = `**🔍 Perplexity Web Search Results**

✅ Found **${validProducts.length}** product listing${validProducts.length === 1 ? '' : 's'} across **${uniqueSources.length}** retailer${uniqueSources.length === 1 ? '' : 's'}

**📊 Price Analysis:**
• **Range:** $${min_price.toFixed(2)} - $${max_price.toFixed(2)}
• **Average:** $${average_price.toFixed(2)}
• **Median:** $${median_price.toFixed(2)}

**🏪 Retailers Found:** ${uniqueSources.join(', ')}

**🔍 Search Quality:** ${searchQuality}

**💡 Note:** Prices are from real-time web search. Always verify current prices and availability on retailer websites before purchasing.`;

    return {
      success: true,
      products: validProducts,
      query: productQuery,
      summary,
      average_price,
      price_range: { min: min_price, max: max_price }
    };

  } catch (error) {
    console.error('❌ Perplexity search failed:', error);
    return {
      success: false,
      products: [],
      query: productQuery,
      summary: `**Search Failed:** ${error instanceof Error ? error.message : 'Unknown error'}\n\nThere was an issue connecting to Perplexity's search service. This could be due to:\n• API quota exceeded\n• Network connectivity issues\n• Service temporarily unavailable\n\n**Suggestion:** Please try again in a few moments or check retailer websites directly.`
    };
  }
}

/**
 * Manual extraction fallback for when JSON parsing fails
 */
function extractProductsManually(content: string): ProductResult[] {
  const products: ProductResult[] = [];
  
  try {
    // Look for title patterns followed by price patterns, including images
    const titlePricePattern = /"title":\s*"([^"]+)"[\s\S]*?"price":\s*([\d.]+)[\s\S]*?"source":\s*"([^"]*)"[\s\S]*?"link":\s*"([^"]*)"[\s\S]*?"image":\s*"([^"]*)"[\s\S]*?"condition":\s*"([^"]*)"[\s\S]*?"availability":\s*"([^"]*)"/g;
    
    let match;
    let count = 0;
    
    while ((match = titlePricePattern.exec(content)) !== null && count < 15) {
      const title = match[1];
      const price = parseFloat(match[2]);
      const source = match[3] || 'Unknown';
      const link = match[4] || '';
      const image = match[5] || undefined;
      const condition = match[6] || 'Unknown';
      const availability = match[7] || 'Check website';
      
      if (title && price > 0) {
        products.push({
          title: title.trim(),
          price,
          source: source.trim(),
          link: link.trim(),
          image: image && image.trim() !== '' ? image.trim() : undefined,
          condition: condition.trim(),
          availability: availability.trim()
        });
        count++;
      }
    }
    
    console.log(`Manual extraction found ${products.length} products`);
    return products;
    
  } catch (error) {
    console.error('Manual extraction failed:', error);
    return [];
  }
}

/**
 * Combined image + web search: identify product from image then search web
 */
export async function searchByImage(imageBase64: string): Promise<AIWebSearchResult> {
  try {
    console.log('🖼️ Starting image-based product search...');
    
    // Step 1: Identify the product from the image
    const productDescription = await identifyProductFromImage(imageBase64);
    
    if (!productDescription) {
      throw new Error('Could not identify product from image');
    }
    
    // Step 2: Search the web for that product using Perplexity
    const searchResult = await searchWebWithPerplexity(productDescription);
    
    // Add the image identification context to the summary
    searchResult.summary = `🖼️ **Product Identified:** ${productDescription}\n\n${searchResult.summary || ''}`;
    
    return searchResult;
    
  } catch (error) {
    console.error('❌ Image search failed:', error);
    return {
      success: false,
      products: [],
      query: 'Image Search',
      summary: `**Image search failed:** ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Main export - use Perplexity for all web searches
export async function searchWebWithOpenAI(productQuery: string): Promise<AIWebSearchResult> {
  return searchWebWithPerplexity(productQuery);
}

// Legacy compatibility functions
export async function searchWebWithChatGPT(productQuery: string): Promise<AIWebSearchResult> {
  return searchWebWithPerplexity(productQuery);
}

export async function simpleAIWebSearch(productQuery: string): Promise<AIWebSearchResult> {
  return searchWebWithPerplexity(productQuery);
} 