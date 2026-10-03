-- Workspace data lives only in "User"."snapshot". The relational Bean, Brew,
-- and Machine tables have had no reader or writer since the snapshot rewrite.
DROP TABLE IF EXISTS "Brew";
DROP TABLE IF EXISTS "Bean";
DROP TABLE IF EXISTS "Machine";

DROP TYPE IF EXISTS "Status";
DROP TYPE IF EXISTS "DominantNote";
DROP TYPE IF EXISTS "Botanic";
DROP TYPE IF EXISTS "Designation";
