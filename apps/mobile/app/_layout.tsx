import { Stack } from "expo-router";
import { AuthProvider } from "../src/auth";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AccountUnavailable } from "../src/unavailable";
import { Platform } from "react-native";
export default function RootLayout() {
  const appId = process.env.EXPO_PUBLIC_PRIVY_APP_ID,
    clientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID,
    domain = process.env.EXPO_PUBLIC_PASSKEY_DOMAIN;
  if (
    !appId ||
    !process.env.EXPO_PUBLIC_API_URL ||
    (Platform.OS !== "web" && (!clientId || !domain))
  )
    return (
      <SafeAreaProvider>
        <AccountUnavailable />
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <AuthProvider appId={appId} clientId={clientId}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
