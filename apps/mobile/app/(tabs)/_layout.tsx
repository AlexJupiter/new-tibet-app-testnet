import { Tabs, Redirect } from "expo-router";
import { AuthBoundary } from "../../src/auth";
import { Ionicons } from "@expo/vector-icons";
import { MemberProvider } from "../../src/member";
import { Loading, Screen, Notice, colors } from "../../src/ui";
export default function TabLayout() {
  return (
    <AuthBoundary
      loading={<Loading />}
      unauthenticated={<Redirect href="/sign-in" />}
      error={(error) => (
        <Screen title="Unable to sign in">
          <Notice error={error.message} />
        </Screen>
      )}
    >
      <MemberProvider>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.blue,
            tabBarInactiveTintColor: colors.muted,
            tabBarStyle: { borderTopColor: colors.line },
            tabBarLabelStyle: { fontSize: 11 },
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" color={color} size={size} />
            ),
          }}
        >
          <Tabs.Screen name="profile" options={{ title: "Profile" }} />
          <Tabs.Screen
            name="wallet"
            options={{
              title: "Wallet",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="wallet-outline" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="announcements"
            options={{
              title: "Announcements",
              tabBarIcon: ({ color, size }) => (
                <Ionicons
                  name="notifications-outline"
                  color={color}
                  size={size}
                />
              ),
            }}
          />
        </Tabs>
      </MemberProvider>
    </AuthBoundary>
  );
}
