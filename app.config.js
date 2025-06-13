import 'dotenv/config';

export default {
  expo: {
    name: 'BidPeek',
    slug: 'ebay-resale-estimator',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'bidpeek',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      bundleIdentifier: 'com.bidpeek.app',
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription:
          'This app uses the camera to take photos of items for price estimation and analysis.',
        NSPhotoLibraryUsageDescription:
          'This app needs access to your photo library to select existing photos of items for price estimation and analysis.',
        ITSAppUsesNonExemptEncryption: false,
        NSFaceIDUsageDescription: "BidPeek uses Face ID to securely log you into your account.",
      },
    },
    android: {
      package: 'com.bidpeek.app',
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#000000',
      },
      permissions: [
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: ['expo-router'],
    extra: {
      OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      PERPLEXITY_API_KEY: process.env.EXPO_PUBLIC_PERPLEXITY_API_KEY,
      ebayClientId: process.env.EBAY_CLIENT_ID || 'KeithZah-bidpeek-PRD-9efff03ae-f2d8c8c1',
      ebayClientSecret: process.env.EBAY_CLIENT_SECRET || 'PRD-efff03ae1b85-75a1-442e-8910-1b22',
      eas: {
        projectId: '6ce7af29-946f-4907-ab49-0afa92e97b72',
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      ebayProdClientId: process.env.EBAY_PROD_CLIENT_ID,
      ebayProdClientSecret: process.env.EBAY_PROD_CLIENT_SECRET,
    },
  },
};
