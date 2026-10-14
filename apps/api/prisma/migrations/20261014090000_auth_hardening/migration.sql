-- Scope invitation tokens to a single organisation so accepting one invite
-- activates only that membership.
ALTER TABLE "user_tokens" ADD COLUMN "organization_id" UUID;

-- Refresh-token rotation: remember the previous token to tolerate concurrent
-- refreshes briefly and to detect reuse of a stolen token afterwards.
ALTER TABLE "sessions" ADD COLUMN "previous_refresh_token_hash" VARCHAR(128);
ALTER TABLE "sessions" ADD COLUMN "refresh_rotated_at" TIMESTAMP(3);
CREATE UNIQUE INDEX "sessions_previous_refresh_token_hash_key" ON "sessions"("previous_refresh_token_hash");
