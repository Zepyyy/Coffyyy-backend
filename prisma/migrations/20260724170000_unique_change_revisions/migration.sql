-- A revision is the resumable pull cursor within one workspace.
DROP INDEX "Change_userId_revision_idx";
CREATE UNIQUE INDEX "Change_userId_revision_key" ON "Change"("userId", "revision");
