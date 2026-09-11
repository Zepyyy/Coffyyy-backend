-- Composite primary key makes owner-scoped idempotency authoritative.
DROP INDEX IF EXISTS "ImportRun_userId_idempotencyKey_key";

ALTER TABLE "ImportRun"
ADD CONSTRAINT "ImportRun_pkey"
PRIMARY KEY ("userId", "idempotencyKey");
