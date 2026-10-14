CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY,value text NOT NULL);
CREATE TABLE IF NOT EXISTS admin_nonces (nonce text PRIMARY KEY,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS admin_sessions (token_hash text PRIMARY KEY,csrf text NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS members (user_id text PRIMARY KEY,wallet text UNIQUE NOT NULL,profile text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS challenges (user_id text PRIMARY KEY REFERENCES members(user_id) ON DELETE CASCADE,code text NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS verification_requests (
 id uuid PRIMARY KEY,user_id text NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,wallet text NOT NULL,
 reference text UNIQUE NOT NULL,challenge text,profile text,
 status text NOT NULL CHECK (status IN ('pending','rejected','verified','revoked','expired')) DEFAULT 'pending',
 attestation_uid text UNIQUE,transaction_hash text UNIQUE,reason text,
 created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,evidence_expires_at timestamptz NOT NULL DEFAULT now()+interval '60 days',
 consent_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_live_request_per_member ON verification_requests(user_id) WHERE status IN ('pending','verified');
CREATE INDEX IF NOT EXISTS request_queue ON verification_requests(created_at DESC);
CREATE TABLE IF NOT EXISTS evidence (id uuid PRIMARY KEY,request_id uuid NOT NULL REFERENCES verification_requests(id) ON DELETE CASCADE,kind text NOT NULL,mime text NOT NULL,encrypted text NOT NULL);
CREATE TABLE IF NOT EXISTS announcements (id uuid PRIMARY KEY,title text NOT NULL,body text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS announcement_reads (user_id text REFERENCES members(user_id) ON DELETE CASCADE,announcement_id uuid REFERENCES announcements(id) ON DELETE CASCADE,PRIMARY KEY(user_id,announcement_id));
CREATE TABLE IF NOT EXISTS audit_log (id bigserial PRIMARY KEY,action text NOT NULL,resource text NOT NULL,actor text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
