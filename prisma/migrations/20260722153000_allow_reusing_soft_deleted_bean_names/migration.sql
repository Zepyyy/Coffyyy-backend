-- Soft-deleted beans must not reserve a name for their owner.
DROP INDEX "Bean_name_userId_key";

CREATE UNIQUE INDEX "Bean_name_userId_active_key"
ON "Bean"("name", "userId")
WHERE "deletedAt" IS NULL;
