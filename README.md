# AI-ItemSalesEstimator

A cross-platform Expo/React Native app for eBay resellers, powered by Supabase and OpenAI. Track search history, lock items into hauls, and visualize profit analytics with beautiful charts.

---

## Features

- **Supabase Auth**: Secure email/password login
- **Search History**: All searches synced to Supabase
- **Haul Dashboard**: Add items to a haul, track purchase/sale price, margin, and profit
- **Data Visualization**: Donut chart for spent vs. revenue (react-native-gifted-charts)
- **OpenAI Integration**: Infer eBay search fields from product descriptions
- **Offline Support**: Local fallback for search history

---

## Getting Started

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Expo CLI](https://docs.expo.dev/get-started/installation/):
  ```sh
  npm install -g expo-cli
  ```
- [Git](https://git-scm.com/)

### 2. Clone the Repository

```sh
git clone https://github.com/ziggyboy2001/AI-ItemSalesEstimator.git
cd AI-ItemSalesEstimator
```

### 3. Install Dependencies

```sh
npm install
```

### 4. Environment Variables

Create a `.env` file in the project root and add your environment variables:

```env
# OpenAI API Key for image identification
EXPO_PUBLIC_OPENAI_API_KEY=sk-...your-openai-key...

# Perplexity API Key for web search (get from https://docs.perplexity.ai/)
EXPO_PUBLIC_PERPLEXITY_API_KEY=pplx-...your-perplexity-key...

# Supabase configuration
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## API Keys Setup

### Perplexity API (Required for AI Web Search)

1. Visit [Perplexity API Settings](https://docs.perplexity.ai/guides/getting-started)
2. Create an account and add a payment method
3. Generate an API key
4. Add credits to your account ($5+ recommended)
5. Copy the API key to your `.env` file

### OpenAI API (Required for Image Identification)

1. Visit [OpenAI API](https://platform.openai.com/api-keys)
2. Generate an API key
3. Add credits to your account
4. Copy the API key to your `.env` file

### 5. Supabase Setup

- The app uses a hosted Supabase project. If you want to use your own, update `services/supabaseClient.ts` with your Supabase URL and anon key.
- **Schema:**

```
# Table: searches
- id: uuid (pk)
- user_id: uuid (fk to users)
- query: text
- image_url: text (optional)
- ai_keywords: text
- ai_category_id: text
- ai_aspects: jsonb
- ai_excluded: text
- results_count: int
- created_at: timestamptz

# Table: saved_items
- id: uuid (pk)
- user_id: uuid (fk to users)
- ebay_item_id: text
- title: text
- image_url: text
- sale_price: numeric
- shipping_price: numeric/text
- date_sold: text
- condition: text
- buying_format: text
- link: text
- user_notes: text (optional)
- saved_at: timestamptz

# Table: hauls
- id: uuid (pk)
- user_id: uuid (fk to users)
- name: text
- finished: boolean
- finished_at: timestamptz
- created_at: timestamptz

# Table: haul_items
- id: uuid (pk)
- haul_id: uuid (fk to hauls)
- title: text
- image_url: text
- purchase_price: numeric
- sale_price: numeric
- added_at: timestamptz

# Table: user_settings (optional)
- user_id: uuid (pk/fk to users)
- default_filters: jsonb
```

---

## Running the App

### Start the Expo Dev Server

```sh
npm run dev
```

- Scan the QR code with the Expo Go app (iOS/Android), or run on an emulator/simulator.

---

## Usage

### Authentication

- Sign up or sign in with email/password.
- Auth is managed by Supabase.

### Search & Haul Workflow

1. **Search for an item** (uses OpenAI to infer eBay search fields)
2. **Review results** and lock items into your current haul
3. **Enter purchase price** and expected sale price for each item
4. **View your Haul Dashboard**:
   - Donut chart: Total Spent vs. Potential Revenue
   - List of items, margins, and profit
   - Finish haul to lock it (cannot be undone)

### Data Visualization

- The Haul Dashboard uses `react-native-gifted-charts` for a donut chart.
- Slices: "Spent" and "Revenue"; center label shows "Profit".

### Deleting Items

- Tap the trash icon to remove an item from your haul (with confirmation).

---

## OpenAI Integration

- The app uses OpenAI's GPT-4o to infer eBay API request fields from product descriptions.
- **API key is required** (see Environment Variables above).

---

## Troubleshooting

- **Push blocked by GitHub?** Remove secrets from your code and history before pushing.
- **API keys not loading?** Make sure `.env` is present and restart the dev server.
- **Supabase errors?** Check your project URL and anon key in `services/supabaseClient.ts`.

---

## License

MIT

## AI Web Search Fallback

When eBay doesn't return results for specific items (like the exact "Pokémon Scarlet & Violet Miraidon Elite Trainer Box"), the app automatically uses AI-powered web search as a fallback.

**How it works:**

1. **Enhanced AI Vision**: Extracts text and identifies exact product variants
2. **eBay Search First**: Tries multiple strategies on eBay completed listings
3. **AI Web Search Fallback**: If no eBay results, AI searches the web for current listings
4. **Multi-Source Results**: Finds prices from eBay, Amazon, TCGPlayer, specialty stores
5. **Smart Data Extraction**: AI extracts pricing and availability information

**Benefits:**

- ✅ **No additional API keys needed** - uses your existing OpenAI key
- ✅ **Finds specific variants** - perfect for collectibles and rare items
- ✅ **Current market data** - gets real-time listings, not just historical
- ✅ **Automatic fallback** - seamlessly tries web search when eBay fails
- ✅ **Multiple sources** - compares prices across marketplaces

The UI clearly shows whether data came from "eBay" or "AI Web Search" so you know the source.
