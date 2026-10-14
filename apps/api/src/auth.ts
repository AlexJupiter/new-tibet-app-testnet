import { createRemoteJWKSet, jwtVerify } from "jose";
import type { FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { SiweMessage } from "siwe";
import type { Config } from "./config.js";
import { ADMIN_ADDRESS, CHAIN_ID } from "../../../packages/protocol/index.js";
import { hash } from "./crypto.js";
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export function validateAdminMessage(text: string, origin: string) {
  let m: SiweMessage;
  try {
    m = new SiweMessage(text);
  } catch {
    throw new HttpError(400, "Invalid login message");
  }
  if (
    m.address.toLowerCase() !== ADMIN_ADDRESS ||
    m.domain !== new URL(origin).host ||
    m.uri !== origin ||
    m.chainId !== CHAIN_ID ||
    m.version !== "1" ||
    !m.expirationTime ||
    !m.issuedAt
  )
    throw new HttpError(401, "Invalid administrator login");
  const now = Date.now();
  if (
    Date.parse(m.expirationTime) <= now ||
    Date.parse(m.issuedAt) > now + 30000 ||
    now - Date.parse(m.issuedAt) > 5 * 60 * 1000 ||
    Date.parse(m.expirationTime) - Date.parse(m.issuedAt) > 5 * 60 * 1000
  )
    throw new HttpError(401, "Login challenge expired");
  return m;
}
export function auth(config: Config, pool: Pool) {
  const jwks = createRemoteJWKSet(
    new URL(
      `https://auth.privy.io/api/v1/apps/${config.PRIVY_APP_ID}/jwks.json`,
    ),
  );
  return {
    origin(req: FastifyRequest) {
      if (req.headers.origin !== config.ADMIN_ORIGIN)
        throw new HttpError(403, "Origin not allowed");
    },
    async admin(req: FastifyRequest, mutation = false) {
      const token = req.cookies.nt_admin;
      if (!token) throw new HttpError(401, "Administrator login required");
      const { rows } = await pool.query(
        "SELECT csrf FROM admin_sessions WHERE token_hash=$1 AND expires_at>now()",
        [hash(token)],
      );
      if (!rows[0]) throw new HttpError(401, "Administrator session expired");
      if (
        mutation &&
        (req.headers.origin !== config.ADMIN_ORIGIN ||
          req.headers["x-csrf-token"] !== rows[0].csrf)
      )
        throw new HttpError(403, "Invalid request protection token");
      return rows[0].csrf as string;
    },
    async member(req: FastifyRequest) {
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!token) throw new HttpError(401, "Passkey login required");
      let sub: string;
      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer: "privy.io",
          audience: config.PRIVY_APP_ID,
          algorithms: ["ES256"],
        });
        if (!payload.sub) throw new Error();
        sub = payload.sub;
      } catch {
        throw new HttpError(401, "Invalid or expired member session");
      }
      const response = await fetch(
        `https://auth.privy.io/api/v1/users/${encodeURIComponent(sub)}`,
        {
          headers: {
            "privy-app-id": config.PRIVY_APP_ID,
            Authorization: `Basic ${Buffer.from(`${config.PRIVY_APP_ID}:${config.PRIVY_APP_SECRET}`).toString("base64")}`,
          },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok)
        throw new HttpError(503, "Unable to validate wallet ownership");
      const user = (await response.json()) as {
        id?: string;
        linked_accounts: {
          type: string;
          chain_type?: string;
          wallet_client_type?: string;
          address?: string;
        }[];
      };
      if (user.id && user.id !== sub)
        throw new HttpError(
          401,
          "Provider user does not match the member session",
        );
      if (!user.linked_accounts.some((a) => a.type === "passkey"))
        throw new HttpError(
          403,
          "A linked passkey is required for New Tibet membership",
        );
      const wallets = user.linked_accounts.filter(
        (a) =>
          a.type === "wallet" &&
          a.chain_type === "ethereum" &&
          a.wallet_client_type === "privy" &&
          a.address &&
          /^0x[0-9a-fA-F]{40}$/.test(a.address),
      );
      if (!wallets.length)
        throw new HttpError(
          409,
          "Your embedded wallet is still being created. Please retry.",
        );
      const existing = await pool.query(
        "SELECT wallet FROM members WHERE user_id=$1",
        [sub],
      );
      const wallet =
        existing.rows[0]?.wallet ?? wallets[0].address!.toLowerCase();
      if (!wallets.some((a) => a.address!.toLowerCase() === wallet))
        throw new HttpError(403, "Member wallet is no longer linked");
      return { id: sub, wallet };
    },
  };
}
