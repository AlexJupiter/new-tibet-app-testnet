import { useCallback, type ReactNode } from "react";
import {
  PrivyProvider,
  usePrivy as useBrowserPrivy,
  useWallets,
  useLoginWithPasskey,
  useSignupWithPasskey,
} from "@privy-io/react-auth";
import { sepolia } from "viem/chains";
export function AuthProvider({
  appId,
  children,
}: {
  appId: string;
  clientId?: string;
  children: ReactNode;
}) {
  return (
    <PrivyProvider
      appId={appId}
      clientId={process.env.EXPO_PUBLIC_PRIVY_WEB_CLIENT_ID || undefined}
      config={{
        defaultChain: sepolia,
        supportedChains: [sepolia],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        appearance: { theme: "light", accentColor: "#1b2a5b" },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
export function usePrivy() {
  const { ready, authenticated, user, logout } = useBrowserPrivy();
  const { ready: walletsReady } = useWallets();
  return {
    isReady: ready && (!authenticated || walletsReady),
    user: authenticated ? user : null,
    logout,
  };
}
export function useEmbeddedEthereumWallet() {
  const { wallets } = useWallets();
  return {
    wallets: wallets
      .filter((wallet) => wallet.walletClientType === "privy")
      .map((wallet) => ({
        address: wallet.address,
        getProvider: () => wallet.getEthereumProvider(),
      })),
  };
}
export function useAccessToken() {
  const { getAccessToken } = useBrowserPrivy();
  return useCallback(() => getAccessToken(), [getAccessToken]);
}
export function usePasskeys() {
  const { loginWithPasskey } = useLoginWithPasskey();
  const { signupWithPasskey } = useSignupWithPasskey();
  return { login: () => loginWithPasskey(), signup: () => signupWithPasskey() };
}
export function AuthBoundary({
  children,
  loading,
  unauthenticated,
}: {
  children: ReactNode;
  loading: ReactNode;
  unauthenticated: ReactNode;
  error: (error: Error) => ReactNode;
}) {
  const { isReady, user } = usePrivy();
  if (!isReady) return loading;
  if (!user) return unauthenticated;
  return children;
}
