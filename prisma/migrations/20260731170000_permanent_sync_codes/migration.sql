-- Pairing credentials are permanent until explicitly replaced.
ALTER TABLE "SyncCode" DROP COLUMN "expiresAt";
