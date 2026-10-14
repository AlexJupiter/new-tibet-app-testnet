# Validation · 14 October 2026

## Passed locally

| Check | Result |
| --- | --- |
| TypeScript checks | API, administrator website, and native app passed |
| Test suite | 36 tests passed across 4 files |
| Database integration | Real isolated PostgreSQL 14 database; authenticated API flows, profile/evidence encryption, nonce replay rejection, JWT verification, CSRF, passkey requirement, announcements/read receipts, deletion and retention |
| EVM tests | Resolver deployed on an Ethereum VM; valid EAS calls accepted, unauthorized issuers/direct calls rejected, revocation restrictions and exact immutable runtime bytecode verified |
| Trust rules | Wrong recipient/issuer/schema/reference, expired/revoked/malformed/non-revocable attestations rejected |
| Compiler | Solidity 0.8.37, optimizer 200 runs, Paris target; reproducible artifact checked in |
| API build | Production Node.js ESM bundle generated |
| Admin website | Vite production build generated; HTTP preview served successfully |
| iOS bundle | Production Hermes bundle exported successfully, approximately 8.1 MB |
| Android bundle | Production Hermes bundle exported successfully, approximately 8.3 MB |
| Native projects | Expo prebuild succeeded for iOS and Android; iOS webcredentials entitlement generated; camera/microphone permissions removed |
| Expo compatibility | `expo install --check` reports dependencies up to date |
| CI lockfile | `npm ci --dry-run` succeeded |
| Release guard | Correctly refuses missing provider/domain/EAS configuration |
| API production dependency audit | 0 vulnerabilities for `npm audit --workspace apps/api --omit=dev` |

The JWT integration tests use a locally generated ES256 key and a mocked provider lookup, while retaining real JWT signature/issuer/audience/expiry validation. They do not claim a live Privy account connection. Contract tests execute the actual compiled resolver bytecode, rather than a JavaScript substitute.

## Remaining verification

No provider accounts or signing credentials were supplied. No signed IPA/AAB/APK, store submission, hosted website/API deployment, live passkey recovery, or real Sepolia schema/attestation transaction was performed. Physical-device testing and an end-to-end live attestation/revocation are required after account setup. The supplied Docker configurations were not executed because the local Docker daemon was unavailable. Browser automation was unavailable; website checks cover build and HTTP serving, not a browser-driven admin session.

The deletion action removes New Tibet profile data; it retains the separate Privy wallet account and permanent onchain records. Resolve full account/wallet deletion, fund recovery, privacy disclosures and store review requirements before public distribution.

## Dependency audit and compatibility

The complete dependency tree still reports **14 high-severity findings**, originating from two upstream advisories and propagated through mobile build tooling:

- [braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The available upstream release is 3.0.3 and remains affected.
- [node-forge RSA signature-verification advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv). The available upstream release is 1.4.0 and remains affected.

Do not describe this as an audit-clean or independently security-audited release. Re-audit and review exposure before distribution; no unreviewed cryptographic/parser patches were invented to hide these findings. The deployed API dependency audit is separately clean.

Available fixes were applied for test tooling, Solidity's temporary-file dependency, native build image tooling, UUID bounds checking, and URI decoding. The patched URI decoder is ESM, while Expo Router's query-string 7 expects a CommonJS function. A small checked-in adapter preserves the upstream implementation and correct export shape; query parsing and both native bundles were tested after this change.

Privy's SDK currently has conflicting viem peer patch pins. The repository uses `legacy-peer-deps=true` consistently, declares the native peers it uses, and verifies TypeScript, Expo compatibility and native exports. Native compilation, provider authentication and wallet actions still require the account/device checks above. Metro also emits upstream package-export fallback warnings for noble crypto imports; bundle generation succeeds.
