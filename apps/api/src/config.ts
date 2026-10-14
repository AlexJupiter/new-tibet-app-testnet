import { z } from "zod";
export function loadConfig(env = process.env) {
  const c = z
    .object({
      NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),
      PORT: z.coerce.number().default(3001),
      DATABASE_URL: z.string().min(1),
      ADMIN_ORIGIN: z.url(),
      SEPOLIA_RPC_URL: z.url(),
      PRIVY_APP_ID: z.string().min(1),
      PRIVY_APP_SECRET: z.string().min(1),
      DATA_ENCRYPTION_KEY: z.string(),
      PASSKEY_DOMAIN: z.string().optional(),
      APPLE_TEAM_ID: z.string().optional(),
      ANDROID_CERT_FINGERPRINTS: z.string().optional(),
      TRUST_PROXY_CIDRS: z.string().optional(),
      MEMBER_WEB_ORIGINS: z.string().default(""),
    })
    .parse(env);
  if (Buffer.from(c.DATA_ENCRYPTION_KEY, "base64").length !== 32)
    throw new Error("DATA_ENCRYPTION_KEY must be 32 base64-encoded bytes");
  if (c.ADMIN_ORIGIN !== new URL(c.ADMIN_ORIGIN).origin)
    throw new Error("ADMIN_ORIGIN must be an origin without a path");
  for (const origin of c.MEMBER_WEB_ORIGINS.split(",")
    .map((v) => v.trim())
    .filter(Boolean)) {
    if (
      new URL(origin).origin !== origin ||
      (c.NODE_ENV === "production" && !origin.startsWith("https://"))
    )
      throw new Error(
        "Member web origins must be valid HTTPS origins without paths",
      );
  }
  if (
    c.NODE_ENV === "production" &&
    (!c.ADMIN_ORIGIN.startsWith("https://") ||
      !c.SEPOLIA_RPC_URL.startsWith("https://"))
  )
    throw new Error("Production requires HTTPS origins and RPC");
  return c;
}
export type Config = ReturnType<typeof loadConfig>;
