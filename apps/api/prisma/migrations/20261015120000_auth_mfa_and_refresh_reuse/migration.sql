-- Stage 1: MFA (TOTP + recovery codes) and refresh-token reuse detection.

ALTER TABLE "users"
  ADD COLUMN "mfa_secret_encrypted" VARCHAR(255),
  ADD COLUMN "mfa_pending_secret_encrypted" VARCHAR(255),
  ADD COLUMN "mfa_last_used_step" INTEGER;

ALTER TABLE "sessions"
  ADD COLUMN "previous_refresh_token_hash" VARCHAR(128);

CREATE INDEX "sessions_previous_refresh_token_hash_idx" ON "sessions"("previous_refresh_token_hash");

CREATE TABLE "mfa_recovery_codes" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "code_hash" VARCHAR(128) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mfa_recovery_codes_code_hash_key" ON "mfa_recovery_codes"("code_hash");
CREATE INDEX "mfa_recovery_codes_user_id_idx" ON "mfa_recovery_codes"("user_id");

ALTER TABLE "mfa_recovery_codes"
  ADD CONSTRAINT "mfa_recovery_codes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
