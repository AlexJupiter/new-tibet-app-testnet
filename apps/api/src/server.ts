import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Pool } from "pg";
import { decodeEventLog, type Address, type Hex } from "viem";
import {
  ADMIN_ADDRESS,
  CHAIN_ID,
  EAS_ADDRESS,
  encodeIdentity,
  easAbi,
} from "../../../packages/protocol/index.js";
import { auth, HttpError, validateAdminMessage } from "./auth.js";
import { hash, vault } from "./crypto.js";
import { chain } from "./chain.js";
import type { Config } from "./config.js";
import {
  hex32,
  profileInput,
  submissionInput,
  uuid,
  validateEvidence,
} from "./validation.js";

export async function buildServer(config: Config, pool: Pool) {
  const app = Fastify({
    trustProxy:
      config.TRUST_PROXY_CIDRS?.split(",")
        .map((v) => v.trim())
        .filter(Boolean) ?? false,
    logger:
      config.NODE_ENV === "test"
        ? false
        : {
            redact: [
              "req.headers.authorization",
              "req.headers.cookie",
              "res.headers.set-cookie",
            ],
          },
    bodyLimit: 32 * 1024 * 1024,
    requestTimeout: 30000,
  });
  app.addHook("onSend", async (_req, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    return payload;
  });
  await app.register(helmet);
  await app.register(cors, {
    origin: config.ADMIN_ORIGIN,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  const access = auth(config, pool),
    crypt = vault(config.DATA_ENCRYPTION_KEY),
    eth = chain(config.SEPOLIA_RPC_URL);
  const schema = async () => {
    const r = await pool.query(
      "SELECT value FROM settings WHERE key='identity_schema'",
    );
    if (!r.rows[0])
      throw new HttpError(
        503,
        "The administrator must initialize the identity schema",
      );
    return r.rows[0].value as Hex;
  };
  const audit = async (action: string, resource: string) =>
    pool.query(
      "INSERT INTO audit_log(action,resource,actor) VALUES($1,$2,$3)",
      [action, resource, ADMIN_ADDRESS],
    );
  const ensureMember = async (user: { id: string; wallet: string }) =>
    pool.query(
      "INSERT INTO members(user_id,wallet,profile) VALUES($1,$2,$3) ON CONFLICT(user_id) DO NOTHING",
      [
        user.id,
        user.wallet,
        crypt.encrypt(
          JSON.stringify({ displayName: "", country: "", book: "green" }),
          user.id,
        ),
      ],
    );
  const publicRequest = (r: any) =>
    r
      ? {
          id: r.id,
          wallet: r.wallet,
          reference: r.reference,
          status: r.status,
          attestation_uid: r.attestation_uid,
          transaction_hash: r.transaction_hash,
          created_at: r.created_at,
          reason: r.reason ? crypt.decrypt(r.reason, r.id).toString() : null,
        }
      : null;
  const syncRequest = async (r: any) => {
    if (r?.status === "verified") {
      const v = await eth.verify(
        r.attestation_uid,
        await schema(),
        r.wallet,
        r.reference,
      );
      if (!v.valid) {
        const status =
          v.attestation.revocationTime > 0n ? "revoked" : "expired";
        await pool.query(
          "UPDATE verification_requests SET status=$1 WHERE id=$2 AND status='verified'",
          [status, r.id],
        );
        r.status = status;
      }
    }
    return r;
  };
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof z.ZodError)
      return reply
        .code(400)
        .send({
          error: "Invalid input",
          details: error.issues.map((i) => ({
            path: i.path,
            message: i.message,
          })),
        });
    if ((error as any).code === "23505")
      return reply
        .code(409)
        .send({
          error:
            "This action has already been recorded or a verification is already active",
        });
    const status = (error as any).statusCode ?? 500;
    if (status >= 500)
      req.log.error({ message: (error as Error).message }, "Request failed");
    return reply
      .code(status)
      .send({
        error:
          status >= 500
            ? "Service temporarily unavailable"
            : (error as Error).message,
      });
  });
  app.get("/api/health", async () => {
    await pool.query("SELECT 1");
    return { ok: true, chainId: CHAIN_ID };
  });
  app.get("/api/config", async () => ({
    chainId: CHAIN_ID,
    admin: ADMIN_ADDRESS,
    eas: EAS_ADDRESS,
    schemaUID:
      (
        await pool.query(
          "SELECT value FROM settings WHERE key='identity_schema'",
        )
      ).rows[0]?.value ?? null,
  }));
  app.get("/.well-known/apple-app-site-association", async (_req, reply) => {
    if (!config.APPLE_TEAM_ID)
      return reply
        .code(503)
        .send({ error: "Apple association is not configured" });
    return {
      webcredentials: {
        apps: [`${config.APPLE_TEAM_ID}.com.newtibet.testnet`],
      },
    };
  });
  app.get("/.well-known/assetlinks.json", async (_req, reply) => {
    const fingerprints = config.ANDROID_CERT_FINGERPRINTS?.split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (!fingerprints?.length)
      return reply
        .code(503)
        .send({ error: "Android association is not configured" });
    return [
      {
        relation: [
          "delegate_permission/common.handle_all_urls",
          "delegate_permission/common.get_login_creds",
        ],
        target: {
          namespace: "android_app",
          package_name: "com.newtibet.testnet",
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ];
  });
  app.post(
    "/api/admin/nonce",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req) => {
      access.origin(req);
      const nonce = randomBytes(16).toString("hex");
      await pool.query(
        "INSERT INTO admin_nonces(nonce,expires_at) VALUES($1,now()+interval '5 minutes')",
        [nonce],
      );
      return { nonce };
    },
  );
  app.post(
    "/api/admin/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      access.origin(req);
      const input = z
        .object({
          message: z.string().max(2048),
          signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
        })
        .parse(req.body);
      const m = validateAdminMessage(input.message, config.ADMIN_ORIGIN);
      const n = await pool.query(
        "DELETE FROM admin_nonces WHERE nonce=$1 AND expires_at>now() RETURNING nonce",
        [m.nonce],
      );
      if (!n.rowCount)
        throw new HttpError(401, "Challenge is expired or already used");
      try {
        const result = await m.verify({
          signature: input.signature,
          domain: new URL(config.ADMIN_ORIGIN).host,
          nonce: m.nonce,
        });
        if (!result.success) throw new Error();
      } catch {
        throw new HttpError(401, "Invalid administrator signature");
      }
      const token = randomBytes(32).toString("hex"),
        csrf = randomBytes(32).toString("hex");
      await pool.query(
        "INSERT INTO admin_sessions(token_hash,csrf,expires_at) VALUES($1,$2,now()+interval '2 hours')",
        [hash(token), csrf],
      );
      reply.setCookie("nt_admin", token, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 7200,
      });
      await audit("login", "admin");
      return { csrf, address: ADMIN_ADDRESS };
    },
  );
  app.get("/api/admin/session", async (req) => ({
    csrf: await access.admin(req),
    address: ADMIN_ADDRESS,
  }));
  app.post("/api/admin/logout", async (req, reply) => {
    await access.admin(req, true);
    await pool.query("DELETE FROM admin_sessions WHERE token_hash=$1", [
      hash(req.cookies.nt_admin!),
    ]);
    reply.clearCookie("nt_admin", { path: "/" });
    return { ok: true };
  });
  app.post("/api/admin/schema", async (req) => {
    await access.admin(req, true);
    const input = z.object({ uid: hex32 }).parse(req.body);
    const uid = input.uid.toLowerCase() as Hex;
    await eth.validateSchema(uid);
    const r = await pool.query(
      "INSERT INTO settings(key,value) VALUES('identity_schema',$1) ON CONFLICT(key) DO NOTHING RETURNING value",
      [uid],
    );
    if (!r.rowCount && (await schema()).toLowerCase() !== uid.toLowerCase())
      throw new HttpError(
        409,
        "A different identity schema is already configured",
      );
    await audit("initialize_schema", uid);
    return { uid };
  });
  app.get("/api/me", async (req) => {
    const user = await access.member(req);
    await ensureMember(user);
    const m = await pool.query("SELECT profile FROM members WHERE user_id=$1", [
      user.id,
    ]);
    const r = await pool.query(
      "SELECT * FROM verification_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1",
      [user.id],
    );
    return {
      wallet: user.wallet,
      profile: JSON.parse(crypt.decrypt(m.rows[0].profile, user.id).toString()),
      verification: publicRequest(await syncRequest(r.rows[0])),
    };
  });
  app.put("/api/me/profile", async (req) => {
    const user = await access.member(req);
    const profile = profileInput.parse(req.body);
    await ensureMember(user);
    await pool.query("UPDATE members SET profile=$1 WHERE user_id=$2", [
      crypt.encrypt(JSON.stringify(profile), user.id),
      user.id,
    ]);
    return { profile };
  });
  app.post("/api/me/challenge", async (req) => {
    const user = await access.member(req);
    await ensureMember(user);
    const code = randomBytes(4).toString("hex").toUpperCase();
    await pool.query(
      "INSERT INTO challenges(user_id,code,expires_at) VALUES($1,$2,now()+interval '30 minutes') ON CONFLICT(user_id) DO UPDATE SET code=$2,expires_at=now()+interval '30 minutes'",
      [user.id, code],
    );
    return { code };
  });
  app.post(
    "/api/me/verification",
    { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } },
    async (req) => {
      const user = await access.member(req),
        input = submissionInput.parse(req.body);
      let evidence;
      try {
        evidence = validateEvidence(input.evidence);
      } catch (e) {
        throw new HttpError(400, (e as Error).message);
      }
      await schema();
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        const challenge = await db.query(
          "DELETE FROM challenges WHERE user_id=$1 AND code=$2 AND expires_at>now() RETURNING code",
          [user.id, input.challenge],
        );
        if (!challenge.rowCount)
          throw new HttpError(
            400,
            "Challenge has expired. Create a new challenge and video.",
          );
        const m = await db.query(
          "SELECT profile FROM members WHERE user_id=$1 FOR UPDATE",
          [user.id],
        );
        const profile = profileInput.parse(
          JSON.parse(crypt.decrypt(m.rows[0].profile, user.id).toString()),
        );
        const id = randomUUID(),
          reference = ("0x" + randomBytes(32).toString("hex")) as Hex;
        await db.query(
          "INSERT INTO verification_requests(id,user_id,wallet,reference,challenge,profile) VALUES($1,$2,$3,$4,$5,$6)",
          [
            id,
            user.id,
            user.wallet,
            reference,
            crypt.encrypt(input.challenge, id),
            crypt.encrypt(JSON.stringify(profile), id),
          ],
        );
        for (const e of evidence) {
          const eid = randomUUID();
          await db.query(
            "INSERT INTO evidence(id,request_id,kind,mime,encrypted) VALUES($1,$2,$3,$4,$5)",
            [eid, id, e.kind, e.mime, crypt.encrypt(e.bytes, eid)],
          );
        }
        await db.query("COMMIT");
        return { id, status: "pending", reference };
      } catch (e) {
        await db.query("ROLLBACK");
        throw e;
      } finally {
        db.release();
      }
    },
  );
  app.delete("/api/me", async (req) => {
    const user = await access.member(req);
    await pool.query("DELETE FROM members WHERE user_id=$1", [user.id]);
    return {
      ok: true,
      message:
        "New Tibet profile and evidence deleted. Public attestations remain onchain. Delete your wallet account in Privy separately.",
    };
  });
  app.get("/api/announcements", async (req) => {
    const user = await access.member(req);
    await ensureMember(user);
    const r = await pool.query(
      "SELECT a.*,r.user_id IS NOT NULL AS read FROM announcements a LEFT JOIN announcement_reads r ON r.announcement_id=a.id AND r.user_id=$1 ORDER BY a.created_at DESC LIMIT 100",
      [user.id],
    );
    return { announcements: r.rows };
  });
  app.post("/api/announcements/:id/read", async (req) => {
    const user = await access.member(req),
      id = uuid.parse((req.params as any).id);
    await pool.query(
      "INSERT INTO announcement_reads(user_id,announcement_id) SELECT $1,id FROM announcements WHERE id=$2 ON CONFLICT DO NOTHING",
      [user.id, id],
    );
    return { ok: true };
  });
  app.get("/api/admin/requests", async (req) => {
    await access.admin(req);
    const r = await pool.query(
      "SELECT id,wallet,status,created_at,attestation_uid,transaction_hash FROM verification_requests ORDER BY created_at DESC LIMIT 200",
    );
    return { requests: r.rows };
  });
  app.get("/api/admin/requests/:id", async (req) => {
    await access.admin(req);
    const id = uuid.parse((req.params as any).id);
    const r = await pool.query(
      "SELECT * FROM verification_requests WHERE id=$1",
      [id],
    );
    if (!r.rows[0]) throw new HttpError(404, "Request not found");
    const record = await syncRequest(r.rows[0]);
    const e = await pool.query(
      "SELECT id,kind,mime FROM evidence WHERE request_id=$1",
      [id],
    );
    await audit("view_request", id);
    return {
      ...publicRequest(record),
      profile: record.profile
        ? JSON.parse(crypt.decrypt(record.profile, id).toString())
        : null,
      challenge: record.challenge
        ? crypt.decrypt(record.challenge, id).toString()
        : null,
      evidence: e.rows,
    };
  });
  app.get("/api/admin/evidence/:id", async (req, reply) => {
    await access.admin(req);
    const id = uuid.parse((req.params as any).id);
    const r = await pool.query(
      "SELECT e.* FROM evidence e JOIN verification_requests r ON r.id=e.request_id WHERE e.id=$1 AND r.evidence_expires_at>now()",
      [id],
    );
    if (!r.rows[0])
      throw new HttpError(404, "Evidence has expired or was deleted");
    await audit("view_evidence", id);
    reply
      .header("Cache-Control", "no-store")
      .header("Content-Disposition", "inline")
      .header("X-Content-Type-Options", "nosniff")
      .type(r.rows[0].mime);
    return crypt.decrypt(r.rows[0].encrypted, id);
  });
  app.get("/api/admin/requests/:id/attest", async (req) => {
    await access.admin(req);
    const id = uuid.parse((req.params as any).id);
    const r = await pool.query(
      "SELECT * FROM verification_requests WHERE id=$1 AND status='pending' AND evidence_expires_at>now()",
      [id],
    );
    if (!r.rows[0])
      throw new HttpError(409, "This request is not available for review");
    const count = await pool.query(
      "SELECT count(*)::int AS count FROM evidence WHERE request_id=$1",
      [id],
    );
    if (count.rows[0].count !== 5)
      throw new HttpError(409, "Evidence is unavailable");
    const block = await eth.client.getBlock();
    return {
      schema: await schema(),
      recipient: r.rows[0].wallet,
      expirationTime: Number(block.timestamp) + 365 * 86400,
      data: encodeIdentity(r.rows[0].reference),
    };
  });
  app.post("/api/admin/requests/:id/approve", async (req) => {
    await access.admin(req, true);
    const id = uuid.parse((req.params as any).id);
    const { transactionHash } = z
      .object({ transactionHash: hex32 })
      .parse(req.body);
    const record = (
      await pool.query("SELECT * FROM verification_requests WHERE id=$1", [id])
    ).rows[0];
    if (!record) throw new HttpError(404, "Request not found");
    if (
      record.status === "verified" &&
      record.transaction_hash === transactionHash
    )
      return { uid: record.attestation_uid };
    if (record.status !== "pending")
      throw new HttpError(409, "Request is no longer pending");
    const receipt = await eth.client.getTransactionReceipt({
      hash: transactionHash as Hex,
    });
    if (
      receipt.status !== "success" ||
      receipt.to?.toLowerCase() !== EAS_ADDRESS.toLowerCase() ||
      receipt.from.toLowerCase() !== ADMIN_ADDRESS
    )
      throw new HttpError(400, "Invalid administrator attestation transaction");
    const head = await eth.client.getBlockNumber();
    if (head - receipt.blockNumber < 2n)
      throw new HttpError(
        409,
        "Wait for three Sepolia confirmations, then retry saving this receipt",
      );
    let uid: Hex | undefined;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== EAS_ADDRESS.toLowerCase()) continue;
      try {
        const e = decodeEventLog({
          abi: easAbi,
          data: log.data,
          topics: log.topics,
        });
        if (
          e.eventName === "Attested" &&
          e.args.recipient.toLowerCase() === record.wallet &&
          e.args.attester.toLowerCase() === ADMIN_ADDRESS &&
          e.args.schemaUID === (await schema())
        )
          uid = e.args.uid;
      } catch {}
    }
    if (
      !uid ||
      !(
        await eth.verify(
          uid,
          await schema(),
          record.wallet as Address,
          record.reference,
        )
      ).valid
    )
      throw new HttpError(
        400,
        "The onchain attestation does not verify this request",
      );
    const saved = await pool.query(
      "UPDATE verification_requests SET status='verified',attestation_uid=$1,transaction_hash=$2,reviewed_at=now() WHERE id=$3 AND status='pending' RETURNING id",
      [uid, transactionHash, id],
    );
    if (!saved.rowCount)
      throw new HttpError(409, "Request changed during review");
    await audit("approve", id);
    return { uid };
  });
  app.post("/api/admin/requests/:id/reject", async (req) => {
    await access.admin(req, true);
    const id = uuid.parse((req.params as any).id),
      { reason } = z
        .object({ reason: z.string().trim().min(1).max(300) })
        .parse(req.body);
    const r = await pool.query(
      "UPDATE verification_requests SET status='rejected',reason=$1,reviewed_at=now() WHERE id=$2 AND status='pending' RETURNING id",
      [crypt.encrypt(reason, id), id],
    );
    if (!r.rowCount) throw new HttpError(409, "Request is no longer pending");
    await audit("reject", id);
    return { ok: true };
  });
  app.post("/api/admin/requests/:id/sync", async (req) => {
    await access.admin(req, true);
    const id = uuid.parse((req.params as any).id);
    const r = (
      await pool.query("SELECT * FROM verification_requests WHERE id=$1", [id])
    ).rows[0];
    if (!r) throw new HttpError(404, "Request not found");
    return publicRequest(await syncRequest(r));
  });
  app.get("/api/admin/announcements", async (req) => {
    await access.admin(req);
    return {
      announcements: (
        await pool.query(
          "SELECT * FROM announcements ORDER BY created_at DESC LIMIT 100",
        )
      ).rows,
    };
  });
  app.post("/api/admin/announcements", async (req) => {
    await access.admin(req, true);
    const input = z
      .object({
        title: z.string().trim().min(1).max(160),
        body: z.string().trim().min(1).max(5000),
      })
      .parse(req.body);
    const id = randomUUID();
    await pool.query(
      "INSERT INTO announcements(id,title,body) VALUES($1,$2,$3)",
      [id, input.title, input.body],
    );
    await audit("publish_announcement", id);
    return { id };
  });
  app.delete("/api/admin/announcements/:id", async (req) => {
    await access.admin(req, true);
    const id = uuid.parse((req.params as any).id);
    await pool.query("DELETE FROM announcements WHERE id=$1", [id]);
    await audit("delete_announcement", id);
    return { ok: true };
  });
  return app;
}
