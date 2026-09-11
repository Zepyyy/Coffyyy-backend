-- Snapshot sync keeps workspace rows and auth state. Remove only legacy sync
-- metadata/tables; never delete User, Bean, Brew, or Machine rows.

DROP TABLE IF EXISTS "Change";
DROP TABLE IF EXISTS "PushOperation";
DROP TABLE IF EXISTS "ImportRun";

DROP INDEX IF EXISTS "Bean_name_userId_active_key";
DROP INDEX IF EXISTS "Machine_name_userId_active_key";
DROP INDEX IF EXISTS "Bean_userId_clientId_key";
DROP INDEX IF EXISTS "Brew_userId_clientId_key";
DROP INDEX IF EXISTS "Machine_userId_clientId_key";

ALTER TABLE "Bean"
  DROP COLUMN IF EXISTS "clientId",
  DROP COLUMN IF EXISTS "revision",
  DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "Brew"
  DROP COLUMN IF EXISTS "clientId",
  DROP COLUMN IF EXISTS "revision",
  DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "Machine"
  DROP COLUMN IF EXISTS "clientId",
  DROP COLUMN IF EXISTS "revision",
  DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "revisionCounter";

CREATE UNIQUE INDEX IF NOT EXISTS "Bean_name_userId_key"
  ON "Bean"("name", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Machine_name_userId_key"
  ON "Machine"("name", "userId");

DROP TYPE IF EXISTS "ChangeOperation";
DROP TYPE IF EXISTS "SyncedEntityType";
