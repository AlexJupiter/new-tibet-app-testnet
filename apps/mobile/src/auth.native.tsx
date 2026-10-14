import type { ReactNode } from "react";
import { useCallback } from "react";
import { PrivyProvider, usePrivyClient } from "@privy-io/expo";
import { PrivyElements } from "@privy-io/expo/ui";
import {
  useLoginWithPasskey,
  useSignupWithPasskey,
} from "@privy-io/expo/passkey";
import { sepolia } from "viem/chains";
export {
  AuthBoundary,
  usePrivy,
  useEmbeddedEthereumWallet,
} from "@privy-io/expo";
export function AuthProvider({
  appId,
  clientId,
  children,
}: {
  appId: string;
  clientId?: string;
  children: ReactNode;
}) {
  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId!}
      supportedChains={[sepolia]}
      config={{
        embedded: { ethereum: { createOnLogin: "users-without-wallets" } },
      }}
    >
      {children}
      <PrivyElements />
    </PrivyProvider>
  );
}
export function useAccessToken() {
  const client = usePrivyClient();
  return useCallback(() => client.getAccessToken(), [client]);
}
export function usePasskeys() {
  const { loginWithPasskey } = useLoginWithPasskey();
  const { signupWithPasskey } = useSignupWithPasskey();
  const options = {
    relyingParty: `https://${process.env.EXPO_PUBLIC_PASSKEY_DOMAIN}`,
  };
  return {
    login: async () => {
      await loginWithPasskey(options);
    },
    signup: async () => {
      await signupWithPasskey(options);
    },
  };
}
