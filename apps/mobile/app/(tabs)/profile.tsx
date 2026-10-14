import { showDialog } from "../../src/dialogs";
import { useEffect, useState, useRef } from "react";
import {
  Text,
  TextInput,
  View,
  Linking,
  RefreshControl,
  Image,
  Switch,
} from "react-native";
import { usePrivy } from "../../src/auth";
import { pickEvidence, releaseEvidence } from "../../src/media";
import { EVIDENCE_KINDS as kinds, type Evidence } from "../../src/evidence";
import { useApi } from "../../src/api";
import { useMember } from "../../src/member";
import { Screen, Card, Button, Notice, s, colors } from "../../src/ui";
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
  const previousFiles = useRef<Evidence[]>([]);
  const mounted = useRef(true);
  useEffect(() => {
    releaseEvidence(
      previousFiles.current.filter(
        (old) => !files.some((file) => file.uri === old.uri),
      ),
    );
    previousFiles.current = files;
  }, [files]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      releaseEvidence(previousFiles.current);
    };
  }, []);
  const pick = async (kind: string) => {
    const file = await pickEvidence(kind);
    if (!file) return;
    if (!mounted.current) {
      releaseEvidence([file]);
      return;
    }
    setFiles((current) => [...current.filter((f) => f.kind !== kind), file]);
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
              showDialog("Profile saved");
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
                    showDialog(
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
          showDialog(
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
