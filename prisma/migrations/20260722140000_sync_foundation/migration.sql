-- CreateEnum
CREATE TYPE "SyncedEntityType" AS ENUM ('BEAN', 'BREW', 'MACHINE');

-- CreateEnum
CREATE TYPE "ChangeOperation" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- AlterTable: Bean
ALTER TABLE "Bean" ADD COLUMN "clientId" TEXT;
ALTER TABLE "Bean" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Bean" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable: Brew
ALTER TABLE "Brew" ADD COLUMN "clientId" TEXT;
ALTER TABLE "Brew" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Brew" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable: Machine
ALTER TABLE "Machine" ADD COLUMN "clientId" TEXT;
ALTER TABLE "Machine" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Machine" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable: User
ALTER TABLE "User" ADD COLUMN "revisionCounter" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex: per-user clientId uniqueness
CREATE UNIQUE INDEX "Bean_userId_clientId_key" ON "Bean"("userId", "clientId");
CREATE UNIQUE INDEX "Brew_userId_clientId_key" ON "Brew"("userId", "clientId");
CREATE UNIQUE INDEX "Machine_userId_clientId_key" ON "Machine"("userId", "clientId");

-- DropForeignKey: Brew never cascades a Bean/Machine delete to historical brews (ADR-0002)
ALTER TABLE "Brew" DROP CONSTRAINT "Brew_beanId_fkey";
ALTER TABLE "Brew" DROP CONSTRAINT "Brew_machineId_fkey";

-- AddForeignKey
ALTER TABLE "Brew" ADD CONSTRAINT "Brew_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Brew" ADD CONSTRAINT "Brew_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: Change (append-only sync log, source of truth for pull/tombstones/7-day recovery — ADR-0001)
CREATE TABLE "Change" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "entityType" "SyncedEntityType" NOT NULL,
    "serverId" INTEGER NOT NULL,
    "clientId" TEXT,
    "revision" INTEGER NOT NULL,
    "operation" "ChangeOperation" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Change_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Change_userId_revision_idx" ON "Change"("userId", "revision");

ALTER TABLE "Change" ADD CONSTRAINT "Change_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: PushOperation (per-outbox-operation idempotency dedup, distinct from ImportRun)
CREATE TABLE "PushOperation" (
    "userId" INTEGER NOT NULL,
    "operationId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "revision" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushOperation_pkey" PRIMARY KEY ("userId", "operationId")
);

ALTER TABLE "PushOperation" ADD CONSTRAINT "PushOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Internal sync tables stay unreachable through Supabase browser roles, matching Session/SyncCode.
ALTER TABLE "Change" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushOperation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny browser access" ON "Change"
    AS RESTRICTIVE FOR ALL TO anon, authenticated
    USING (false) WITH CHECK (false);

CREATE POLICY "Deny browser access" ON "PushOperation"
    AS RESTRICTIVE FOR ALL TO anon, authenticated
    USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE "Change" FROM anon, authenticated;
REVOKE ALL ON TABLE "PushOperation" FROM anon, authenticated;
