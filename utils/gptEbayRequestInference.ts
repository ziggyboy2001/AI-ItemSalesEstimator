import Constants from 'expo-constants';
import type { EbayCompletedRequest } from '@/services/ebayCompletedApi';

// Uses the OpenAI API key from Expo config extra (set in app.config.js or app.json)
const OPENAI_API_KEY = Constants.expoConfig?.extra?.OPENAI_API_KEY;
console.log('OPENAI_API_KEY:', OPENAI_API_KEY);
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Uses GPT to infer the eBay API request fields from a product description or search term.
 * @param searchTerm The main search term (user-editable)
 * @returns An object matching EbayCompletedRequest, with all fields inferred except keywords
 */
export async function inferEbayRequestFields(searchTerm: string): Promise<Omit<EbayCompletedRequest, 'keywords'> & { keywords: string }> {
  const systemPrompt = `
You are an expert at formatting eBay search API requests. 
Given a product name or description, infer the best possible values for the following fields for a completed items search on eBay:
- excluded_keywords (space-separated, e.g. reproduction fake manual box damaged lot)
- max_search_results (default 240)
- category_id (eBay category id, if possible)
- remove_outliers (true/false)
- site_id (0 for US)
- aspects (array of {name, value} for things like Platform, Game Name, Region Code, Rating, etc. Always include Region Code and Rating if possible. Use the most official/precise game name.)
Respond ONLY with a valid JSON object matching this TypeScript type:

interface EbayCompletedRequest {
  keywords: string;
  excluded_keywords?: string;
  max_search_results?: string;
  category_id?: string;
  remove_outliers?: string;
  site_id?: string;
  aspects?: { name: string; value: string }[];
}
`;

  const body = {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Product: ${searchTerm}` }
    ]
  };

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('Failed to infer eBay request fields: ' + errorText);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content?.trim();
  if (content?.startsWith('```')) {
    // Remove Markdown code block (```json ... ``` or ``` ... ```)
    content = content.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
  }
  try {
    const json = JSON.parse(content);
    console.log('GPT-inferred eBay API request body:', json);
    if (json.excluded_keywords) {
      json.excluded_keywords = json.excluded_keywords.replace(/,/g, ' ');
    }
    return json;
  } catch (e) {
    throw new Error('Failed to parse GPT response as JSON: ' + content);
  }
} 