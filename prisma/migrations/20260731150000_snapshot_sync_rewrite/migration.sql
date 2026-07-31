-- Snapshot sync rewrite. Existing application data is intentionally disposable
-- before rollout; this migration adds the new workspace state columns.
ALTER TABLE "User"
  ADD COLUMN "snapshotVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "snapshot" JSONB;

ALTER TABLE "SyncCode"
  ALTER COLUMN "expiresAt" DROP NOT NULL;
