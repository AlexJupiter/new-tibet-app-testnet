# Browser app and GitHub Pages

Website: **https://alexjupiter.github.io/new-tibet-app-testnet-pages/**

The website uses the same source screens as iOS and Android, in `apps/mobile/app`. It is not a separate mock or a second implementation of membership and wallet behavior. Platform adapters supply the browser Privy SDK, file picker, browser confirmations, and refresh controls. The website reads and writes the same API, PostgreSQL records, embedded wallet, and Sepolia EAS identity status.

| Feature | iOS / Android / browser |
| --- | --- |
| Account | Passkey signup, login, session restoration and signout |
| Profile | Display name/pseudonym, country, Green/Blue Book selection, saving and deletion |
| Verification | Challenge, four photos and video, consent, submission, review notes/status and EAS link |
| Wallet | Embedded Ethereum wallet, real Sepolia balance, address copy, receive QR, confirmed ETH transfers |
| Announcements | Feed, refresh and persisted per-member read receipts |

## Hosting

GitHub refused Pages on the private source repository under the current account plan. A separate public repository, `AlexJupiter/new-tibet-app-testnet-pages`, contains compiled website assets on its `site` branch. GitHub Pages serves this branch. It does not contain the API, database, raw native app source, credentials, or uploaded identity evidence.

Pages hosts the member frontend. It cannot run the Node API or PostgreSQL database. The administrator desk/API are deployed separately using `docs/DEPLOYMENT.md`. The published build currently has no configured provider IDs or live API URL and displays an account-access notice; it does not invent balances, identities, or announcements.

## Enable account actions

Use the **same Privy app ID** as the native app/API to share member accounts and embedded wallets. Configure a browser app client if desired, and permit the website origin in Privy. Set these public build values:

```text
EXPO_PUBLIC_PRIVY_APP_ID
EXPO_PUBLIC_PRIVY_WEB_CLIENT_ID   # Optional browser client; do not reuse a restricted native client
EXPO_PUBLIC_API_URL              # HTTPS URL of the deployed shared API
EXPO_PUBLIC_SEPOLIA_RPC_URL
EXPO_WEB_BASE_URL=/new-tibet-app-testnet-pages
```

Set API `MEMBER_WEB_ORIGINS=https://alexjupiter.github.io`. This is an origin, with no repository path. For a custom domain, configure its exact HTTPS origin instead. The browser sends verified bearer tokens without administrator cookies. The API permits profile PUT/DELETE preflights and rejects administrator session reads from a member website origin, while retaining all admin signature/CSRF checks.

Native passkeys require Apple/Android association files at the **root of the relying-party domain**. A GitHub project Pages site does not control the parent domain's `/.well-known/` paths. For the same passkey to work across browser and native apps, choose a shared relying-party domain, configure the native associations there, and serve the web app at that domain with correctly served association files. Different relying-party domains do not automatically share a passkey. The account/domain setup remains deferred as previously requested.

Before collecting real identity evidence, use an isolated app origin/domain: projects under the same `alexjupiter.github.io` origin share browser storage. Verify privacy settings and live passkey/account recovery on physical devices and browsers after configuration.

## Build and update

From the repository root:

```sh
npm ci
EXPO_WEB_BASE_URL=/new-tibet-app-testnet-pages npm run web:build
npm run web:publish
```

Publishing requires an authenticated GitHub CLI with write access to the public deployment repository. The helper checks artifacts, uses a temporary checkout, preserves branch history, and pushes compiled files only. It never copies server `.env` files, node_modules, source maps or identity records. GitHub then deploys the `site` branch. The generated `deployment.json` exposes only the source commit, chain, configuration-present flag, tab names and public base path.

The build provides direct-load HTML shells for `/profile/`, `/wallet/`, `/announcements/` and `/sign-in/`, a 404 shell, correct project-relative assets, and `.nojekyll` for Expo's underscore asset paths. GitHub Pages is not a backend proxy. All authenticated requests use the separately configured API URL.

For CI-based updates, run the manual **Publish member website** workflow after creating environment `member-website`. Add the public values as environment variables named `PRIVY_APP_ID`, `PRIVY_WEB_CLIENT_ID`, `API_URL`, and `SEPOLIA_RPC_URL`. Supply `PAGES_DEPLOY_TOKEN` as a secret with contents-write access to the deployment repository. No existing personal token has been copied into GitHub secrets.

For a future custom root-domain deployment, use an empty `EXPO_WEB_BASE_URL` and configure GitHub Pages/DNS. The current publish helper deliberately targets the project URL; adapt its base-path check and CNAME configuration when switching domains.

Official references: [Expo GitHub Pages publishing](https://docs.expo.dev/guides/publishing-websites/), [Privy browser setup](https://docs.privy.io/basics/react/setup), and [native passkey associations](https://docs.privy.io/basics/react-native/advanced/setup-passkeys).
