import { useState } from "react";
import { Text, View } from "react-native";
import { usePrivy } from "@privy-io/expo";
import {
  useLoginWithPasskey,
  useSignupWithPasskey,
} from "@privy-io/expo/passkey";
import { Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, Button, Notice, Loading, s, colors } from "../src/ui";
export default function SignIn() {
  const { isReady, user } = usePrivy(),
    { loginWithPasskey } = useLoginWithPasskey(),
    { signupWithPasskey } = useSignupWithPasskey();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!isReady) return <Loading />;
  if (user) return <Redirect href="/(tabs)/profile" />;
  const authenticate = async (signup: boolean) => {
    setBusy(true);
    setError("");
    try {
      const relyingParty = `https://${process.env.EXPO_PUBLIC_PASSKEY_DOMAIN}`;
      if (signup) await signupWithPasskey({ relyingParty });
      else await loginWithPasskey({ relyingParty });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title={"Your identity.\nYour New Tibet."}>
      <Text style={s.body}>
        Join with your Green Book or Blue Book. Keep your identity and wallet
        together, protected by a passkey.
      </Text>
      <Card>
        <Ionicons name="finger-print-outline" color={colors.blue} size={42} />
        <Text style={[s.h2, { marginTop: 20 }]}>A secure place to belong.</Text>
        <Text style={s.body}>
          Create your account with Face ID, your fingerprint, or your device
          PIN. Your embedded wallet is created automatically.
        </Text>
        <Button
          title={busy ? "Opening passkey…" : "Create account with passkey"}
          disabled={busy}
          onPress={() => void authenticate(true)}
        />
        <Button
          title="Sign in with passkey"
          secondary
          disabled={busy}
          onPress={() => void authenticate(false)}
        />
        <Notice error={error} />
      </Card>
      <View style={{ gap: 14, marginVertical: 20 }}>
        {[
          ["shield-checkmark-outline", "Identity reviewed by New Tibet"],
          ["wallet-outline", "Your embedded Ethereum wallet"],
          ["notifications-outline", "Updates from the community"],
        ].map(([icon, text]) => (
          <View key={text} style={[s.row, { alignItems: "center" }]}>
            <Ionicons name={icon as any} size={22} color={colors.blue} />
            <Text style={s.body}>{text}</Text>
          </View>
        ))}
      </View>
      <Text style={s.small}>
        Sepolia testnet only. Test ETH has no monetary value. Keep access to
        your passkey in your password manager to recover your account.
      </Text>
    </Screen>
  );
}
