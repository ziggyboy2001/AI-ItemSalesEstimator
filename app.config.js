import 'dotenv/config';

export default {
  expo: {
    name: 'BidPeek',
    slug: 'bidpeek',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'myapp',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription:
          'This app needs access to the camera to take photos for item identification and search.',
        NSPhotoLibraryUsageDescription:
          'This app needs access to the photo library to select images for item identification and search.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
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
    plugins: [
      'expo-router',
      [
        'expo-image-picker',
        {
          photosPermission:
            'The app accesses your photos to let you select images for item identification and search.',
          cameraPermission:
            'The app accesses your camera to let you take photos for item identification and search.',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      PERPLEXITY_API_KEY: process.env.EXPO_PUBLIC_PERPLEXITY_API_KEY,
    },
  },
};
