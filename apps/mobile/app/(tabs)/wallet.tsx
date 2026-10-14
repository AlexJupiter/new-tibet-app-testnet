import { showDialog } from "../../src/dialogs";
import { useEffect, useState } from "react";
import { Text, TextInput, Linking, RefreshControl, View } from "react-native";
import { usePrivy, useEmbeddedEthereumWallet } from "../../src/auth";
import {
  createPublicClient,
  http,
  formatEther,
  parseEther,
  isAddress,
  toHex,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { useMember } from "../../src/member";
import { Screen, Card, Button, Notice, s, colors } from "../../src/ui";
const client = createPublicClient({
  chain: sepolia,
  transport: http(
    process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL ||
      "https://ethereum-sepolia-rpc.publicnode.com",
  ),
});
export default function Wallet() {
  const { isReady } = usePrivy(),
    { wallets } = useEmbeddedEthereumWallet(),
    { member } = useMember();
  const wallet = wallets.find(
    (w) => w.address.toLowerCase() === member?.wallet.toLowerCase(),
  );
  const [balance, setBalance] = useState<bigint | null>(null),
    [to, setTo] = useState(""),
    [amount, setAmount] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [hash, setHash] = useState<Hex | null>(null),
    [status, setStatus] = useState(""),
    [receive, setReceive] = useState(false);
  const refresh = async () => {
    if (!wallet || !isReady) return;
    setRefreshing(true);
    setError("");
    try {
      if ((await client.getChainId()) !== sepolia.id)
        throw new Error("The wallet RPC must use Sepolia.");
      setBalance(await client.getBalance({ address: wallet.address as Hex }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, [wallet?.address, isReady]);
  async function send() {
    if (!wallet || !isReady) return;
    setBusy(true);
    setError("");
    try {
      if (!isAddress(to)) throw new Error("Enter a valid Ethereum recipient.");
      const value = parseEther(amount);
      if (value <= 0n || balance === null || value >= balance)
        throw new Error(
          "Enter an amount below your balance and leave ETH for gas.",
        );
      const provider = await wallet.getProvider();
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: toHex(sepolia.id) }],
      });
      const chainId = await provider.request({ method: "eth_chainId" });
      if (Number(chainId) !== sepolia.id)
        throw new Error("Switch your wallet to Sepolia.");
      const tx = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: wallet.address,
            to,
            value: toHex(value),
            chainId: toHex(sepolia.id),
          },
        ],
      })) as Hex;
      setHash(tx);
      setStatus("Submitted · awaiting confirmation");
      const receipt = await client.waitForTransactionReceipt({
        hash: tx,
        confirmations: 3,
      });
      if (receipt.status !== "success")
        throw new Error("The transaction reverted.");
      setStatus("Confirmed on Sepolia");
      setAmount("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const confirm = () => {
    if (!isAddress(to) || !/^\d+(\.\d{1,18})?$/.test(amount)) {
      setError("Enter a valid recipient and ETH amount.");
      return;
    }
    showDialog(
      "Confirm Sepolia transfer",
      `Send ${amount} test ETH to ${to}? Network gas fees apply.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send", onPress: () => void send() },
      ],
    );
  };
  return (
    <Screen
      title="Your wallet"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          tintColor={colors.blue}
        />
      }
    >
      <Notice error={error} />
      <Card style={{ backgroundColor: colors.blue, borderColor: colors.blue }}>
        <Text style={[s.small, { color: "#bac8eb", letterSpacing: 1.2 }]}>
          EMBEDDED WALLET · SEPOLIA
        </Text>
        <Text style={s.amount}>
          {balance === null
            ? "—"
            : Number(formatEther(balance)).toLocaleString(undefined, {
                maximumFractionDigits: 6,
              })}
          <Text style={{ fontSize: 17 }}> ETH</Text>
        </Text>
        <Text selectable style={[s.mono, { color: "#d8e2fa" }]}>
          {wallet?.address ?? "Creating your embedded wallet…"}
        </Text>
        <Text style={[s.small, { color: "#bac8eb", marginTop: 16 }]}>
          Secured by your passkey. Sepolia test assets only.
        </Text>
      </Card>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Button
            secondary
            title="Copy address"
            disabled={!wallet}
            onPress={() =>
              void Clipboard.setStringAsync(wallet!.address).then(() =>
                showDialog("Address copied"),
              )
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            secondary
            title={receive ? "Hide QR" : "Receive"}
            disabled={!wallet}
            onPress={() => setReceive(!receive)}
          />
        </View>
      </View>
      {receive && wallet && (
        <Card style={{ alignItems: "center", marginTop: 20 }}>
          <QRCode
            value={`ethereum:${wallet.address}@11155111`}
            size={190}
            color={colors.blue}
          />
          <Text style={[s.small, { marginTop: 20 }]}>
            Receive Sepolia ETH at this address.
          </Text>
        </Card>
      )}
      <Card style={{ marginTop: 24 }}>
        <Text style={s.h2}>Send test ETH</Text>
        <Text style={s.label}>Recipient address</Text>
        <TextInput
          accessibilityLabel="Recipient address"
          autoCapitalize="none"
          autoCorrect={false}
          value={to}
          onChangeText={setTo}
          style={s.input}
          placeholder="0x…"
        />
        <Text style={s.label}>Amount · ETH</Text>
        <TextInput
          accessibilityLabel="Amount in ETH"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          style={s.input}
          placeholder="0.00"
        />
        <Button
          title={busy ? "Waiting for transaction…" : "Review transfer"}
          disabled={busy || !wallet || !isReady || !to || !amount}
          onPress={confirm}
        />
        {hash && (
          <>
            <Text style={[s.small, { marginTop: 16 }]}>{status}</Text>
            <Button
              secondary
              title="View transaction ↗"
              onPress={() =>
                void Linking.openURL(`https://sepolia.etherscan.io/tx/${hash}`)
              }
            />
          </>
        )}
      </Card>
      <Text style={s.small}>
        Test ETH has no monetary value. No $TIBET token or rewards contract has
        been configured for this build.
      </Text>
    </Screen>
  );
}
