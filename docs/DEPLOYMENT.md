# Configure and release

## 1. Provider accounts and domain

Create a Privy app with passkey authentication enabled and an app client for iOS/Android. Use passkeys as the app's login method; the backend also requires a linked passkey. Use the public app/client IDs in `apps/mobile/.env`, and the app ID plus secret in the API secret manager. Enable automatic embedded Ethereum wallet creation. Configure only Ethereum Sepolia for this application. Check Privy's recovery and device/session policies before distributing to members.

Set up an Expo account and run `npx eas-cli@24.13.0 init` from `apps/mobile` to link an EAS project. Set `EAS_PROJECT_ID` to the resulting UUID. Configure signing credentials using `npx eas-cli@24.13.0 credentials` on that account; do not commit certificates, keystores, or service account files.

The default native IDs are `com.newtibet.testnet`. Change them consistently in the mobile config, API association endpoints, and provider dashboards if you choose different identifiers. The app uses Expo SDK 57 and iOS 16.4+. Passkey behavior must be tested on physical iOS and Android devices with the actual signing identity.

Choose a domain such as `verify.your-domain.example`. Serve the admin website and API on the same HTTPS origin. Set:

- API `ADMIN_ORIGIN=https://verify.your-domain.example`.
- Mobile `EXPO_PUBLIC_API_URL=https://verify.your-domain.example`.
- Mobile `EXPO_PUBLIC_PASSKEY_DOMAIN=verify.your-domain.example` (no scheme/path).
- API `PASSKEY_DOMAIN=verify.your-domain.example`.
- API `APPLE_TEAM_ID` to your Apple developer team ID.
- API `ANDROID_CERT_FINGERPRINTS` to comma-separated SHA-256 certificate fingerprints. Include each applicable development/release identity and the Google Play App Signing certificate for Play releases.

The native SDK passes `https://<domain>` to the Privy passkey APIs. The API serves:

```text
/.well-known/apple-app-site-association
/.well-known/assetlinks.json
```

Publish these files without redirects, with a JSON content type, at the exact domain associated with the native app. Add the permitted Android signing hashes and app identifiers to Privy's app-client settings. Native permissions must be reviewed after prebuild, especially the media library disclosure. No camera/microphone permission is requested: users record video in their camera app and select it for review.

## 2. Server deployment

Use a managed PostgreSQL database with encrypted backups and TLS, or the supplied Compose setup. Use a private database network. Supply a cryptographically random `DATA_ENCRYPTION_KEY` and store it securely; losing it makes stored evidence unreadable. Key rotation requires re-encrypting records. Use a reliable Sepolia RPC provider and set `SEPOLIA_RPC_URL`. The server refuses a different chain at startup.

The Compose setup binds the administrator frontend only to `127.0.0.1:8080`. Put an HTTPS reverse proxy or ingress in front of it. Create `apps/api/.env` from its example, with `NODE_ENV=production` and real provider values. Set `DATABASE_PASSWORD` in the deployment environment. URI-encode any special password characters in database connection strings.

```sh
docker compose up --build -d
```

Compose runs the transactional migration job before starting the API. The Dockerfiles and Compose manifest are included; container execution was not available in the authoring environment. Test the exact images in staging before release. Pin image digests in your deployment environment according to your update policy.

If you change the browser RPC provider, set `VITE_SEPOLIA_RPC_URL` at the website build and update the `connect-src` Content Security Policy in `deploy/nginx.conf` to permit its HTTPS origin. Avoid public secrets in that value. The admin browser uses a wallet extension, not a hosted administrator key.

The API's in-memory rate limiter assumes a single API instance. Set `TRUST_PROXY_CIDRS` only to the actual ingress addresses/CIDRs and preserve the forwarding chain so rate limits apply to the client. Proxy trust is disabled by default. Do not trust arbitrary forwarding headers from the internet. For multiple instances, use a shared rate-limit store and tune database connection limits. Configure request size and timeout limits consistently at the edge: uploads are limited to four photos of 2 MB each and one video of 10 MB, encoded in JSON, with a 32 MB request cap. For larger-scale usage, move encrypted evidence to private object storage with authenticated streaming and lifecycle rules.

Verify `/api/health`, TLS, administrator origin checks, database backup restore, and the well-known association files. Monitor the hourly retention job and alert on failures. Live identity reads require the RPC to be available; they fail closed rather than falling back to a stale verified claim.

## 3. Initialize EAS

Fund the authorized administrator wallet with Sepolia ETH. Connect it to the verification website and sign the SIWE login message. Choose **Initialize Sepolia schema**; approve the resolver deployment and schema registration transactions. The website waits for three confirmations and saves the schema UID to PostgreSQL.

EAS: `0xC2679fBD37d54388Ce493F1DB75320D236e1815e`.
SchemaRegistry: `0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0`.

The backend checks the schema structure, revocability, and exact resolver runtime bytecode including its immutable administrator and EAS addresses. It will reject a resolver that only pretends to restrict issuers. The compiler artifact is checked into Git and rebuilt in CI for reproducibility.

For an interrupted schema initialization, the browser retains the resolver address/deployment hash. If you clear browser storage, recover the existing resolver address from the transaction before initializing again. An existing schema UID can be saved by the authenticated `/api/admin/schema` endpoint; it cannot replace an already configured different schema. Contract or administrator changes require an explicit migration plan, not a silent address change.

For an interrupted identity issuance, the application ID and transaction hash are retained in the admin browser. Reopen that application and choose **Save confirmed receipt**. This verifies the original transaction instead of issuing another attestation. Revocations can be synchronized by refreshing/opening the request; the backend reads the actual onchain status.

## 4. Signed mobile releases

Create GitHub environment `mobile-production`. Add secret `EXPO_TOKEN` and repository/environment variables:

```text
EAS_PROJECT_ID
PRIVY_APP_ID
PRIVY_CLIENT_ID
API_URL
PASSKEY_DOMAIN
SEPOLIA_RPC_URL
```

Set the same public values in the EAS production environment, since remote build workers need them. Run the manual **Build signed mobile releases** GitHub workflow. It validates configuration and builds an iOS IPA and Android AAB using EAS. This workflow does not submit to App Store or Google Play automatically.

For local release dispatch:

```sh
cd apps/mobile
npx eas-cli@24.13.0 build --platform all --profile production
```

Before submission, test passkey signup, login and recovery on actual devices, wallet ownership persistence, account switching/signout, insufficient gas and cancelled sends, evidence selection/consent, all three tabs, an actual Sepolia EAS issuance and revocation, and announcement read receipts. Provide store privacy disclosures, New Tibet terms/privacy URLs and support contact details. The current deletion action deletes New Tibet profile/evidence; it explicitly retains the separate Privy wallet account. A full wallet/account deletion process and its funds/recovery implications must be agreed before public store distribution.

## 5. Data and operational boundaries

Book evidence, its review snapshot, challenge, and review note expire 60 days after submission. The server prunes them at startup and hourly. Evidence endpoints reject expired records even before pruning. Database backups need corresponding retention policies; application deletion cannot erase old unmanaged backups.

The display profile stays until the member deletes it. Onchain attestations cannot be erased; a reviewer can revoke them. Public recipient addresses are permanent blockchain identifiers. This app does not guarantee one identity per person. No public personal-data hash or document number is placed in EAS.

The administrator address is fixed for this testnet deployment. Before adding administrators or changing that wallet, design an explicit authority migration and resolver deployment. No administrator key has been supplied, stored, or used by the server.
