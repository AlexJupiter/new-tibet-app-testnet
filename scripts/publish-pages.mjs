import {
  mkdtemp,
  cp,
  writeFile,
  rm,
  readFile,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
const target = "AlexJupiter/new-tibet-app-testnet-pages";
const dir = resolve("apps/mobile/dist-web");
const manifest = JSON.parse(
  await readFile(join(dir, "deployment.json"), "utf8"),
);
if (manifest.baseUrl !== "/new-tibet-app-testnet-pages")
  throw new Error(
    "Build with EXPO_WEB_BASE_URL=/new-tibet-app-testnet-pages before publishing",
  );
async function check(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (
      entry.isSymbolicLink() ||
      /^\.env|\.map$/.test(entry.name) ||
      [".git", "node_modules", "migrations"].includes(entry.name)
    )
      throw new Error(`Unexpected public artifact ${entry.name}`);
    if (entry.isDirectory()) await check(join(path, entry.name));
  }
}
await check(dir);
const stage = await mkdtemp(join(tmpdir(), "new-tibet-pages-"));
const git = (args) =>
  execFileSync("git", args, { cwd: stage, stdio: "inherit" });
try {
  git(["init", "-b", "site"]);
  git(["remote", "add", "origin", `https://github.com/${target}.git`]);
  const exists = execFileSync(
    "git",
    ["ls-remote", "--heads", "origin", "site"],
    { cwd: stage, encoding: "utf8" },
  ).trim();
  if (exists) {
    git(["fetch", "--depth", "1", "origin", "site"]);
    git(["reset", "--hard", "FETCH_HEAD"]);
    for (const name of await readdir(stage))
      if (name !== ".git")
        await rm(join(stage, name), { recursive: true, force: true });
  }
  await cp(dir, stage, { recursive: true });
  await writeFile(
    join(stage, "README.md"),
    "# New Tibet website\n\nThis repository contains only the compiled website published on GitHub Pages. Application and backend source are maintained separately.\n\nWebsite: https://alexjupiter.github.io/new-tibet-app-testnet-pages/\n",
  );
  git(["config", "user.name", "AlexJupiter"]);
  git(["config", "user.email", "7900773+AlexJupiter@users.noreply.github.com"]);
  git(["add", "."]);
  const changes = execFileSync("git", ["status", "--porcelain"], {
    cwd: stage,
    encoding: "utf8",
  }).trim();
  if (changes) {
    git([
      "commit",
      "-m",
      `Publish website from ${manifest.sourceCommit.slice(0, 7)}`,
    ]);
    git([
      "-c",
      "credential.helper=",
      "-c",
      "credential.helper=!gh auth git-credential",
      "push",
      "-u",
      "origin",
      "site",
    ]);
  }
  console.log(
    "Published website build to " +
      target +
      "; GitHub Pages deployment must finish before the URL is live.",
  );
} finally {
  await rm(stage, { recursive: true, force: true });
}
