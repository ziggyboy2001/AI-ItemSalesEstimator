import { OPENAI_API_KEY } from '@env';

// Uses the OpenAI API key from @env (expo-env)
console.log('OPENAI_API_KEY (openaiVision):', OPENAI_API_KEY);
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export async function identifyItemFromImage(base64Image: string): Promise<string> {
  const body = {
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          },
          {
            type: 'text',
            text: 'What is the main item in this image? Respond with a short, clear description suitable for searching online marketplaces. Fewest words possible, be sure to correctly identify the item, we are looking solely for the name of the item. do not include punctuation at the end of the name. Remember, this is being used by the user to search ebay for this item.'
          }
        ]
      }
    ]
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
  };
  console.log('OpenAI headers (openaiVision):', headers);

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', errorText);
    throw new Error('Failed to identify item from image');
  }

  const data = await response.json();
  // Extract the AI's description from the response
  const description = data.choices?.[0]?.message?.content?.trim();
  return description || '';
} 