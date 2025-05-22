const API_HOST = 'ebay-average-selling-price.p.rapidapi.com';
const API_KEY = '10903221a1mshedd4a7be9ba548bp12f649jsn66278f1d8a80';

export interface EbayCompletedRequest {
  keywords: string;
  excluded_keywords?: string;
  max_search_results?: string;
  category_id?: string;
  remove_outliers?: string;
  site_id?: string;
  aspects?: { name: string; value: string }[];
}

export interface EbayCompletedItem {
  item_id: string;
  title: string;
  sale_price: number;
  condition: string;
  buying_format: string;
  date_sold: string;
  image_url: string;
  shipping_price: string | number;
  link: string;
}

export interface EbayCompletedResponse {
  warning: string | null;
  success: boolean;
  average_price: number;
  median_price: number;
  min_price: number;
  max_price: number;
  results: number;
  total_results: number;
  pages_included: number;
  items: EbayCompletedItem[];
}

export async function fetchEbayCompletedItems(request: EbayCompletedRequest): Promise<EbayCompletedResponse> {
  // console.log('Sending request to eBay API:', request);
  const response = await fetch(`https://${API_HOST}/findCompletedItems`, {
    method: 'POST',
    headers: {
      'x-rapidapi-key': API_KEY,
      'x-rapidapi-host': API_HOST,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay API error: ${errorText}`);
  }

  const data = await response.json();
  // console.log('eBay API full response:', data);
  // console.log('API response keys:', Object.keys(data));
  // console.log('data.items:', data.items, 'typeof:', typeof data.items, 'isArray:', Array.isArray(data.items));
  // console.log('data.products:', data.products, 'typeof:', typeof data.products, 'isArray:', Array.isArray(data.products));
  const { warning, success, average_price, median_price, min_price, max_price, results, total_results, pages_included, ...rest } = data;
  let items: EbayCompletedItem[] = [];

  if (Array.isArray(data.products)) {
    items = data.products.map((p: any) => ({
      item_id: p.item_id,
      title: p.title,
      sale_price: Number(p.sale_price),
      condition: p.condition,
      buying_format: p.buying_format,
      date_sold: p.date_sold,
      image_url: p.image_url,
      shipping_price: p.shipping_price,
      link: p.link,
    }));
  } else {
    // fallback for legacy response
    let i = 0;
    while (data[`item_id:${i}`]) {
      items.push({
        item_id: data[`item_id:${i}`],
        title: data[`title:${i}`],
        sale_price: Number(data[`sale_price:${i}`]),
        condition: data[`condition:${i}`],
        buying_format: data[`buying_format:${i}`],
        date_sold: data[`date_sold:${i}`],
        image_url: data[`image_url:${i}`],
        shipping_price: data[`shipping_price:${i}`],
        link: data[`link:${i}`],
      });
      i++;
    }
  }

  return {
    warning,
    success,
    average_price,
    median_price,
    min_price,
    max_price,
    results,
    total_results,
    pages_included,
    items,
  };
} 