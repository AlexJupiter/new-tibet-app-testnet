# New Tibet · Sepolia app

Native iOS and Android app based on [AlexJupiter/new-tibet-app](https://github.com/AlexJupiter/new-tibet-app), plus a wallet-authenticated administrator website and PostgreSQL API. The mobile app contains exactly **Profile, Wallet, and Announcements**.

This repository implements the real integrations and release configuration. It is a **Sepolia-only application**, with no simulated wallet balance, rewards, or verification. It has not been deployed or signed for distribution: Privy, Expo/EAS, Apple/Google signing, a domain, and hosting must be configured first. See [deployment instructions](docs/DEPLOYMENT.md) and [verification results](docs/VALIDATION.md).

## Included

- Profile: pseudonym/display name, membership book, encrypted book photos and challenge video, review status, public attestation link, and deletion of New Tibet profile data.
- Wallet: Privy embedded Ethereum wallet, native passkey signup/login, real Sepolia balance, receive address/QR, and confirmed ETH transfers with a recipient/amount confirmation.
- Announcements: persisted admin-authored messages and per-member read receipts.
- Admin desk: Sign-In with Ethereum restricted to **0x71AF09966CBED4434ccA97c40Fa38B8083548B95**, private evidence review, schema/resolver initialization, onchain identity issuance/revocation, rejection notes, and announcement publishing.
- Backend: verified Privy JWTs and server-side wallet ownership lookup, PostgreSQL persistence, authenticated AES-256-GCM encryption, CSRF protection, rate limiting, one-use SIWE challenges, audit records, and 60-day evidence deletion.

There are no ecosystem, chat, rewards, invitations, mesh, petition, swap, or other app tabs. No $TIBET token is fabricated; a token contract was not supplied.

## Structure

```text
apps/mobile/           Expo / React Native / Expo Router
apps/admin/            React / Vite administrator website
apps/api/              Fastify API / PostgreSQL migrations
packages/protocol/     Sepolia addresses, EAS ABI, shared trust rules
contracts/             Admin-only EAS identity resolver
deploy/                Container builds, migrations, reverse proxy
tests/                 API, encryption, SIWE, and EVM resolver tests
```

## Develop

Node 22.13+ and PostgreSQL 14+ are required. Native development uses a custom Expo development build, not Expo Go.

```sh
npm ci
npm run contracts:compile
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

Fill in environment settings. `DATA_ENCRYPTION_KEY` must be 32 random bytes encoded in base64; generate it with `openssl rand -base64 32`. Keep this key and the Privy app secret in your server secret manager. They must never appear in mobile environment variables, Git, or browser code.

```sh
npm run db:migrate
npm run dev:api
npm run dev:admin
```

Use the precise origin configured in `ADMIN_ORIGIN` (default `http://localhost:5173`) to open the admin desk. Configure a real HTTPS domain and native passkey associations before testing signup on a phone.

```sh
npm run dev:mobile
# Or create the native development builds:
cd apps/mobile
npx expo run:ios
npx expo run:android
```

## Verify and build

```sh
npm run typecheck
TEST_DATABASE_URL=postgresql://user:password@localhost/newtibet_test npm test
npm run build
npm run mobile:export
```

The database integration suite requires a dedicated database name ending in `_test` and truncates its tables. Without `TEST_DATABASE_URL`, that suite is explicitly skipped. CI provides PostgreSQL and runs it.

`mobile:export` creates production JavaScript/Hermes bundles for both platforms; these are **not installable IPA/AAB binaries**. Use the configured EAS release workflow to build signed binaries. The release configuration check intentionally fails until the public IDs, domain, EAS project, and token are supplied.

## Identity model

An admin reviews the submitted book evidence and challenge video. The website sends an EAS transaction from the administrator's browser wallet; no administrator private key is stored on the server. The resolver contract restricts issuance to that address. The backend requires three confirmations and checks the actual EAS record: schema, recipient, issuer, application reference, expiry, revocation, and payload version.

The schema is `bytes32 memberReference,bool verified,uint8 version`. Its reference is an independent random 32-byte value; it is not a hash of a name, book number, or document. The attestation recipient is the member's embedded wallet. The public chain exposes the wallet address, verification status, issuing wallet, dates, and reference. All book evidence and profile details stay offchain. Attestations expire after one year and can be revoked.

This records New Tibet's human verification decision. It does not prove government identity or automatically detect duplicate identities. The reviewer must check authenticity and possible duplicates according to New Tibet's policy.

## Source and license

Prototype basis: commit `98dae764dc51b42b4d5a954e2302094b81c52a59`. Reused New Tibet branding, book review flow, pseudonym-friendly profile, passkey concept, and announcements behavior. The native application, admin portal, backend, contracts, and tests are newly implemented. Prototype licensing is retained in [LICENSE](LICENSE); the Inter font license accompanies the website asset.

Official integration references: [Privy native setup](https://docs.privy.io/basics/react-native/setup), [native passkey associations](https://docs.privy.io/basics/react-native/advanced/setup-passkeys), and [EAS deployments](https://docs.attest.org/docs/quick--start/contracts).
