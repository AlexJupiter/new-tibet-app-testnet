import { useEffect, useState } from "react";
import {
  Text,
  TextInput,
  View,
  Alert,
  Linking,
  RefreshControl,
  Image,
  Switch,
} from "react-native";
import { usePrivy } from "@privy-io/expo";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { useApi } from "../../src/api";
import { useMember } from "../../src/member";
import { Screen, Card, Button, Notice, s, colors } from "../../src/ui";
type Evidence = { kind: string; mime: string; base64: string; uri: string };
const kinds = ["front", "back", "identity", "challenge", "video"] as const;
export default function Profile() {
  const api = useApi();
  const { member, error, loading, refresh } = useMember(),
    { logout } = usePrivy();
  const [name, setName] = useState(""),
    [country, setCountry] = useState(""),
    [book, setBook] = useState<"green" | "blue">("green"),
    [busy, setBusy] = useState(false),
    [issue, setIssue] = useState(""),
    [challenge, setChallenge] = useState(""),
    [files, setFiles] = useState<Evidence[]>([]),
    [consent, setConsent] = useState(false);
  useEffect(() => {
    if (member) {
      setName(member.profile.displayName);
      setCountry(member.profile.country);
      setBook(member.profile.book);
    }
  }, [
    member?.profile.displayName,
    member?.profile.country,
    member?.profile.book,
  ]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setIssue("");
    try {
      await fn();
    } catch (e) {
      setIssue((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const pick = async (kind: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      throw new Error("Allow photo library access to choose your evidence.");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "video" ? ["videos"] : ["images"],
      quality: 0.75,
      videoMaxDuration: 30,
      base64: kind !== "video",
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if ((asset.fileSize ?? 0) > (kind === "video" ? 10_000_000 : 2_000_000))
      throw new Error("Choose a photo under 2 MB or a video under 10 MB.");
    if (kind === "video" && (asset.duration ?? 0) > 30000)
      throw new Error("Choose a video no longer than 30 seconds.");
    const base64 = asset.base64 ?? (await new File(asset.uri).base64());
    const mime = asset.base64
      ? "image/jpeg"
      : asset.mimeType || (kind === "video" ? "video/mp4" : "image/jpeg");
    setFiles((current) => [
      ...current.filter((f) => f.kind !== kind),
      { kind, mime, base64, uri: asset.uri },
    ]);
  };
  const active =
    member?.verification?.status === "pending" ||
    member?.verification?.status === "verified";
  return (
    <Screen
      title="Your profile"
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void refresh()}
          tintColor={colors.blue}
        />
      }
    >
      <Notice error={error || issue} />
      <Card>
        <Text style={s.badge}>
          {member?.verification?.status ?? "Not yet verified"}
        </Text>
        <Text style={s.h2}>
          {member?.profile.displayName || "Welcome to New Tibet"}
        </Text>
        <Text style={s.body}>Your membership and identity verification.</Text>
        {member?.verification?.reason && (
          <Text style={s.body}>Review note: {member.verification.reason}</Text>
        )}
        {member?.verification?.attestation_uid && (
          <Button
            secondary
            title="View onchain attestation ↗"
            onPress={() =>
              void Linking.openURL(
                `https://sepolia.easscan.org/attestation/view/${member.verification!.attestation_uid}`,
              )
            }
          />
        )}
      </Card>
      <Card>
        <Text style={s.h2}>Profile details</Text>
        <Text style={s.label}>Display name · a pseudonym is welcome</Text>
        <TextInput
          accessibilityLabel="Display name"
          value={name}
          onChangeText={setName}
          maxLength={80}
          style={s.input}
        />
        <Text style={s.label}>Country (optional)</Text>
        <TextInput
          accessibilityLabel="Country"
          value={country}
          onChangeText={setCountry}
          maxLength={80}
          style={s.input}
        />
        <Text style={s.label}>Membership book</Text>
        <View style={s.row}>
          {(["green", "blue"] as const).map((b) => (
            <View key={b} style={{ flex: 1 }}>
              <Button
                secondary={book !== b}
                title={`${b === "green" ? "Green" : "Blue"} Book`}
                onPress={() => setBook(b)}
              />
            </View>
          ))}
        </View>
        <Button
          title="Save profile"
          disabled={busy || !name.trim() || !member}
          onPress={() =>
            void run(async () => {
              await api("/me/profile", "PUT", {
                displayName: name,
                country,
                book,
              });
              await refresh();
              Alert.alert("Profile saved");
            })
          }
        />
      </Card>
      {!active && (
        <Card>
          <Text style={s.h2}>Verify your identity</Text>
          <Text style={s.body}>
            Save your profile, then submit four book photos and a short video
            for human review. Evidence is encrypted and deleted after 60 days.
          </Text>
          {!challenge ? (
            <Button
              title="Start identity verification"
              disabled={busy || !name.trim() || !member}
              onPress={() =>
                void run(async () => {
                  await api("/me/profile", "PUT", {
                    displayName: name,
                    country,
                    book,
                  });
                  const c = await api("/me/challenge", "POST", {});
                  setChallenge(c.code);
                  setFiles([]);
                })
              }
            />
          ) : (
            <>
              <Text style={s.label}>
                Your video challenge · valid for 30 minutes
              </Text>
              <Text style={[s.mono, { fontSize: 24, marginBottom: 12 }]}>
                {challenge}
              </Text>
              <Text style={s.body}>
                Show your face and book in a video of up to 30 seconds. Read the
                challenge above aloud. Include the front, back, identity page,
                and a photo of the book beside this handwritten challenge.
              </Text>
              {kinds.map((kind) => {
                const file = files.find((f) => f.kind === kind);
                return (
                  <View key={kind} style={{ marginVertical: 8 }}>
                    <Button
                      secondary
                      title={`${file ? "✓ Replace" : "Choose"} ${kind === "video" ? "challenge video" : `${kind} photo`}`}
                      disabled={busy}
                      onPress={() => void run(() => pick(kind))}
                    />
                    {file && kind !== "video" && (
                      <Image
                        source={{ uri: file.uri }}
                        style={{
                          height: 80,
                          width: 100,
                          marginTop: 8,
                          borderRadius: 6,
                        }}
                      />
                    )}
                  </View>
                );
              })}
              <View style={[s.row, { alignItems: "center", marginTop: 20 }]}>
                <Switch
                  value={consent}
                  onValueChange={setConsent}
                  accessibilityLabel="Consent to identity verification"
                />
                <Text style={[s.small, { flex: 1 }]}>
                  I consent to review of my evidence and a public Sepolia
                  attestation linking my wallet to verified status. No identity
                  documents are published onchain.
                </Text>
              </View>
              <Button
                title={busy ? "Submitting…" : "Submit for review"}
                disabled={busy || files.length !== 5 || !consent}
                onPress={() =>
                  void run(async () => {
                    await api("/me/verification", "POST", {
                      consent: true,
                      challenge,
                      evidence: files.map(({ uri, ...f }) => f),
                    });
                    setFiles([]);
                    setChallenge("");
                    setConsent(false);
                    await refresh();
                    Alert.alert(
                      "Application submitted",
                      "Your review status will appear here.",
                    );
                  })
                }
              />
              <Button
                secondary
                title="Restart with a new challenge"
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    const c = await api("/me/challenge", "POST", {});
                    setChallenge(c.code);
                    setFiles([]);
                  })
                }
              />
            </>
          )}
        </Card>
      )}
      <Button
        secondary
        title="Sign out"
        disabled={busy}
        onPress={() =>
          void run(async () => {
            setFiles([]);
            await logout();
          })
        }
      />
      <Button
        secondary
        title="Delete New Tibet profile"
        disabled={busy || !member}
        onPress={() =>
          Alert.alert(
            "Delete your profile?",
            "Your New Tibet profile and evidence will be deleted. Your wallet account and public blockchain records remain.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () =>
                  void run(async () => {
                    await api("/me", "DELETE");
                    setFiles([]);
                    await logout();
                  }),
              },
            ],
          )
        }
      />
      <Text style={[s.small, { marginTop: 22 }]}>
        This confirms membership reviewed by New Tibet. It is not a
        government-issued identity document.
      </Text>
    </Screen>
  );
}
