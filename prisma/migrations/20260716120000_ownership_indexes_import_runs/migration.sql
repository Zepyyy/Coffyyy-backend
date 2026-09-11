-- Replace global resource-name uniqueness with per-user uniqueness.
-- Add lookup indexes for owner and brew foreign-key checks.
DROP INDEX IF EXISTS "Bean_name_key";
DROP INDEX IF EXISTS "Machine_name_key";

CREATE UNIQUE INDEX "Bean_name_userId_key" ON "Bean"("name", "userId");
CREATE UNIQUE INDEX "Machine_name_userId_key" ON "Machine"("name", "userId");

CREATE INDEX "Bean_userId_idx" ON "Bean"("userId");
CREATE INDEX "Machine_userId_idx" ON "Machine"("userId");
CREATE INDEX "Brew_userId_idx" ON "Brew"("userId");
CREATE INDEX "Brew_beanId_idx" ON "Brew"("beanId");
CREATE INDEX "Brew_machineId_idx" ON "Brew"("machineId");

CREATE TABLE "ImportRun" (
    "idempotencyKey" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ImportRun_userId_idempotencyKey_key"
ON "ImportRun"("userId", "idempotencyKey");
CREATE INDEX "ImportRun_userId_idx" ON "ImportRun"("userId");

ALTER TABLE "ImportRun"
ADD CONSTRAINT "ImportRun_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
