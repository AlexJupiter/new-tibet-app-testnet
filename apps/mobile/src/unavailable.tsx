import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, s, colors } from "./ui";
export function AccountUnavailable() {
  return (
    <Screen title={"Your identity.\nYour New Tibet."}>
      <Text style={s.body}>
        Your New Tibet membership, wallet, and community updates. Protected by a
        passkey.
      </Text>
      <Card>
        <Ionicons name="finger-print-outline" color={colors.blue} size={42} />
        <Text style={[s.h2, { marginTop: 20 }]}>
          Account access opens soon.
        </Text>
        <Text style={s.body}>
          New Tibet is being connected to its account services. Sign-in and
          account actions will be available when setup is complete.
        </Text>
      </Card>
      <View style={{ gap: 14, marginVertical: 20 }}>
        {[
          [
            "person-outline",
            "Profile",
            "Book verification and membership status.",
          ],
          [
            "wallet-outline",
            "Wallet",
            "Your embedded wallet and Sepolia transfers.",
          ],
          [
            "notifications-outline",
            "Announcements",
            "News and updates from New Tibet.",
          ],
        ].map(([icon, title, body]) => (
          <Card key={title}>
            <Ionicons name={icon as any} size={24} color={colors.blue} />
            <Text style={[s.h2, { marginTop: 12 }]}>{title}</Text>
            <Text style={s.body}>{body}</Text>
          </Card>
        ))}
      </View>
      <Text style={s.small}>
        Sepolia testnet only. Test ETH has no monetary value.
      </Text>
    </Screen>
  );
}
