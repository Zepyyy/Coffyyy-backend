-- Soft-deleted machines must not reserve a name for their owner.
DROP INDEX "Machine_name_userId_key";

CREATE UNIQUE INDEX "Machine_name_userId_active_key"
ON "Machine"("name", "userId")
WHERE "deletedAt" IS NULL;
