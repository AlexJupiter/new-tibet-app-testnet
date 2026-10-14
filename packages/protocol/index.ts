import {
  decodeAbiParameters,
  encodeAbiParameters,
  parseAbi,
  parseAbiParameters,
  type Address,
  type Hex,
} from "viem";
export type { Address, Hex } from "viem";
export const CHAIN_ID = 11155111;
export const ADMIN_ADDRESS =
  "0x71af09966cbed4434cca97c40fa38b8083548b95" as Address;
export const EAS_ADDRESS =
  "0xC2679fBD37d54388Ce493F1DB75320D236e1815e" as Address;
export const REGISTRY_ADDRESS =
  "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0" as Address;
export const ZERO_UID = ("0x" + "0".repeat(64)) as Hex;
export const IDENTITY_SCHEMA =
  "bytes32 memberReference,bool verified,uint8 version";
const fields = parseAbiParameters(IDENTITY_SCHEMA);
export function encodeIdentity(reference: Hex) {
  return encodeAbiParameters(fields, [reference, true, 1]);
}
export function decodeIdentity(data: Hex) {
  const [reference, verified, version] = decodeAbiParameters(fields, data);
  return { reference, verified, version };
}
export const easAbi = parseAbi([
  "function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data) request) payable returns (bytes32)",
  "function revoke((bytes32 schema,(bytes32 uid,uint256 value) data) request) payable",
  "function getAttestation(bytes32 uid) view returns ((bytes32 uid,bytes32 schema,uint64 time,uint64 expirationTime,uint64 revocationTime,bytes32 refUID,address recipient,address attester,bool revocable,bytes data))",
  "event Attested(address indexed recipient,address indexed attester,bytes32 uid,bytes32 indexed schemaUID)",
]);
export const registryAbi = parseAbi([
  "function register(string schema,address resolver,bool revocable) returns (bytes32)",
  "function getSchema(bytes32 uid) view returns ((bytes32 uid,address resolver,bool revocable,string schema))",
  "event Registered(bytes32 indexed uid,address registerer,(bytes32 uid,address resolver,bool revocable,string schema) schema)",
]);
export type Attestation = {
  uid: Hex;
  schema: Hex;
  expirationTime: bigint;
  revocationTime: bigint;
  recipient: Address;
  attester: Address;
  revocable: boolean;
  data: Hex;
};
export function validIdentity(
  a: Attestation,
  schema: Hex,
  wallet: Address,
  reference: Hex,
  now: bigint,
) {
  if (
    a.uid === ZERO_UID ||
    a.schema !== schema ||
    a.recipient.toLowerCase() !== wallet.toLowerCase() ||
    a.attester.toLowerCase() !== ADMIN_ADDRESS ||
    a.revocationTime !== 0n ||
    a.expirationTime <= now ||
    !a.revocable
  )
    return false;
  try {
    const d = decodeIdentity(a.data);
    return d.verified && d.version === 1 && d.reference === reference;
  } catch {
    return false;
  }
}
export type Profile = {
  displayName: string;
  country: string;
  book: "green" | "blue";
};
export type Verification = {
  id: string;
  reference: Hex;
  wallet: Address;
  status: "pending" | "rejected" | "verified" | "revoked" | "expired";
  attestation_uid: Hex | null;
  transaction_hash: Hex | null;
  created_at: string;
  reason: string | null;
  profile?: Profile;
  evidence?: { id: string; kind: string; mime: string }[];
};
export type Member = {
  wallet: Address;
  profile: Profile;
  verification: Verification | null;
};
export type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
};
