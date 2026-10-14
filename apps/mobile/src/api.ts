import { usePrivyClient } from "@privy-io/expo";
import { useCallback } from "react";
export function useApi() {
  const privy = usePrivyClient();
  return useCallback(
    async <T = any>(
      path: string,
      method = "GET",
      body?: unknown,
    ): Promise<T> => {
      const base = process.env.EXPO_PUBLIC_API_URL;
      if (!base) throw new Error("The member API is not configured.");
      const token = await privy.getAccessToken();
      if (!token) throw new Error("Please sign in again.");
      const response = await fetch(`${base.replace(/\/$/, "")}/api${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Unable to complete request.");
      return data;
    },
    [privy],
  );
}
