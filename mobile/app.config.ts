import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Asphodel",
  slug: "shadowsky",
  version: "0.7.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: ["shadowsky", "bsky"],
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0a0a0f",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "io.shadowsky.app",
    associatedDomains: [
      "applinks:shadowsky.io",
      "applinks:main.shadowsky.io",
      "applinks:bsky.app",
      "applinks:staging.bsky.app",
      "applinks:asphodel.is",
      "applinks:main.asphodel.is",
    ],
    infoPlist: {
      UIBackgroundModes: ["remote-notification"],
    },
  },
  notification: {
    icon: "./assets/notification-icon.png",
    color: "#c9a84c",
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
    "expo-router",
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#c9a84c",
        sounds: [],
      },
    ],
    [
      "sentry-expo",
      {
        organization: process.env.SENTRY_ORG || "",
        project: process.env.SENTRY_PROJECT || "",
      },
    ],
    "./plugins/withKeyEvent",
    "./plugins/withPrivacyManifest",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "bb805399-ea1d-4550-9fee-e7ecf9cc8b74",
    },
    sentryDsn: process.env.SENTRY_DSN || "",
  },
});
