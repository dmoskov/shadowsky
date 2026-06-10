import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Asphodel",
  slug: "shadowsky",
  version: "0.8.0",
  runtimeVersion: "0.8.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: ["shadowsky", "bsky", "io.shadowsky.app", "io.shadowsky"],
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0a0a0f",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "io.shadowsky.app",
    // @ts-expect-error deploymentTarget is valid for EAS builds but not in ExpoConfig type
    deploymentTarget: "16.0",
    associatedDomains: [
      "applinks:shadowsky.io",
      "applinks:main.shadowsky.io",
      "applinks:bsky.app",
      "applinks:staging.bsky.app",
      "applinks:asphodel.is",
      "applinks:main.asphodel.is",
    ],
    infoPlist: {
        CFBundleIcons: {
          CFBundleAlternateIcons: {
            light: {
              CFBundleIconFiles: ["icon-light"],
              UIPrerenderedIcon: true,
            },
            mono: {
              CFBundleIconFiles: ["icon-mono"],
              UIPrerenderedIcon: true,
            },
            pride: {
              CFBundleIconFiles: ["icon-pride"],
              UIPrerenderedIcon: true,
            },
          },
        },
      UIBackgroundModes: ["remote-notification"],
      NSCameraUsageDescription: "Take photos for posts and profile",
      NSPhotoLibraryUsageDescription: "Select photos and videos to share",
      NSMicrophoneUsageDescription: "Record video with audio",
      NSFaceIDUsageDescription: "Unlock app with Face ID",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  notification: {
    icon: "./assets/notification-icon.png",
    color: "#ff6b9d",
    androidMode: "default",
    androidCollapsedTitle: "{{unread_count}} new notifications",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0a0a0f",
    },
    package: "io.shadowsky.app",
    permissions: [
      "RECEIVE_BOOT_COMPLETED",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          { scheme: "https", host: "asphodel.is" },
          { scheme: "https", host: "main.asphodel.is" },
          { scheme: "https", host: "shadowsky.io" },
          { scheme: "https", host: "main.shadowsky.io" },
          { scheme: "https", host: "bsky.app" },
          { scheme: "https", host: "staging.bsky.app" },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
  },
  plugins: [
    "./plugins/withAlternateIcons",
    "expo-router",
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#ff6b9d",
        sounds: [],
      },
    ],
    [
      "expo-media-library",
      {
        photosPermission: "Allow $(PRODUCT_NAME) to save images to your photo library",
        savePhotosPermission: "Allow $(PRODUCT_NAME) to save images to your photo library",
        isAccessMediaLocationEnabled: true,
      },
    ],
    [
      "expo-quick-actions",
      {
        iosActions: [
          {
            id: "compose",
            title: "New Post",
            icon: "compose",
            params: { href: "/(app)/compose" },
          },
          {
            id: "search",
            title: "Search",
            icon: "search",
            params: { href: "/(app)/(tabs)/(search)" },
          },
          {
            id: "notifications",
            title: "Notifications",
            icon: "symbol:bell.fill",
            params: { href: "/(app)/(tabs)/(notifications)" },
          },
          {
            id: "messages",
            title: "Messages",
            icon: "message",
            params: { href: "/(app)/messages" },
          },
        ],
      },
    ],
    "expo-screen-orientation",
    "./plugins/withPrivacyManifest",
    "./plugins/withShareExtension",
    "./plugins/withWidgetExtension",
    "./plugins/withIpadOrientations",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "bb805399-ea1d-4550-9fee-e7ecf9cc8b74",
    },
  },
});
