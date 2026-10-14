import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const dir = "apps/mobile/dist-web";
const html = await readFile(join(dir, "index.html"), "utf8");
await writeFile(join(dir, "LICENSE"), await readFile("LICENSE", "utf8"));
if (!html.includes("<html")) throw new Error("Missing web entrypoint");
await writeFile(join(dir, ".nojekyll"), "");
await writeFile(join(dir, "404.html"), html);
for (const route of ["profile", "wallet", "announcements", "sign-in"]) {
  await mkdir(join(dir, route), { recursive: true });
  await writeFile(join(dir, route, "index.html"), html);
}
// This file contains only public deployment metadata; never include account data or secrets.
await writeFile(
  join(dir, "deployment.json"),
  JSON.stringify(
    {
      sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      chainId: 11155111,
      configured: Boolean(
        process.env.EXPO_PUBLIC_PRIVY_APP_ID && process.env.EXPO_PUBLIC_API_URL,
      ),
      tabs: ["Profile", "Wallet", "Announcements"],
      baseUrl: process.env.EXPO_WEB_BASE_URL || "",
    },
    null,
    2,
  ) + "\n",
);
await access(join(dir, "_expo"));
console.log("Prepared GitHub Pages routes and public deployment metadata");
