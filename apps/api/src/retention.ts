import type { Pool } from "pg";
export async function prune(pool: Pool) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query(
      "DELETE FROM evidence USING verification_requests r WHERE evidence.request_id=r.id AND r.evidence_expires_at<=now()",
    );
    await db.query(
      "UPDATE verification_requests SET profile=NULL,challenge=NULL,reason=NULL,status=CASE WHEN status='pending' THEN 'expired' ELSE status END WHERE evidence_expires_at<=now()",
    );
    await db.query("DELETE FROM admin_nonces WHERE expires_at<=now()");
    await db.query("DELETE FROM admin_sessions WHERE expires_at<=now()");
    await db.query("DELETE FROM challenges WHERE expires_at<=now()");
    await db.query(
      "DELETE FROM audit_log WHERE created_at<now()-interval '1 year'",
    );
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
