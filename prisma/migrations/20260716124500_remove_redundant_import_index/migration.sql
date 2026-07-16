-- Primary key already starts with userId; separate index adds no value.
DROP INDEX IF EXISTS "ImportRun_userId_idx";
