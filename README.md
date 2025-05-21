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

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_OPENAI_API_KEY=sk-...your-openai-key...
```

- **Never commit your API keys!**
- The OpenAI key is loaded via Expo config (`app.config.js`).

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
