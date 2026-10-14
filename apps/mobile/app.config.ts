import type { ExpoConfig } from "expo/config";
const domain = process.env.EXPO_PUBLIC_PASSKEY_DOMAIN;
const projectId = process.env.EAS_PROJECT_ID;
const config: ExpoConfig = {
  name: "New Tibet",
  slug: "new-tibet-app-testnet",
  version: "1.0.0",
  scheme: "newtibet",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  platforms: ["ios", "android", "web"],
  web: {
    bundler: "metro",
    output: "single",
    name: "New Tibet",
    favicon: "./assets/icon.png",
  },
  experiments: { baseUrl: process.env.EXPO_WEB_BASE_URL || "" },
  ios: {
    bundleIdentifier: "com.newtibet.testnet",
    supportsTablet: true,
    associatedDomains: domain ? [`webcredentials:${domain}`] : [],
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "com.newtibet.testnet",
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#1b2a5b",
    },
    permissions: [],
    intentFilters: domain
      ? [
          {
            action: "VIEW",
            autoVerify: true,
            data: [{ scheme: "https", host: domain }],
            category: ["BROWSABLE", "DEFAULT"],
          },
        ]
      : [],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    [
      "expo-image-picker",
      {
        photosPermission:
          "Choose your book photos and identity verification video for New Tibet review.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      "expo-build-properties",
      { ios: { deploymentTarget: "16.4" }, android: { minSdkVersion: 28 } },
    ],
  ],
  extra: projectId ? { eas: { projectId } } : {},
  updates: { enabled: false },
};
export default config;
