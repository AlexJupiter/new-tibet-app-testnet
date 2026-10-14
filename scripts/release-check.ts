import { z } from "zod";
const env = z
  .object({
    EXPO_PUBLIC_PRIVY_APP_ID: z.string().min(1),
    EXPO_PUBLIC_PRIVY_CLIENT_ID: z.string().min(1),
    EXPO_PUBLIC_API_URL: z.url().startsWith("https://"),
    EXPO_PUBLIC_PASSKEY_DOMAIN: z
      .string()
      .min(3)
      .regex(/^[a-z0-9.-]+$/),
    EAS_PROJECT_ID: z.uuid(),
    EXPO_TOKEN: z.string().min(1),
    EXPO_PUBLIC_SEPOLIA_RPC_URL: z.url().startsWith("https://"),
  })
  .safeParse(process.env);
if (!env.success) {
  console.error("Release configuration incomplete:");
  for (const i of env.error.issues)
    console.error(`- ${i.path.join(".")}: ${i.message}`);
  process.exit(1);
}
console.log(
  "Public mobile release configuration present. Verify native signing and passkey associations using docs/DEPLOYMENT.md.",
);
