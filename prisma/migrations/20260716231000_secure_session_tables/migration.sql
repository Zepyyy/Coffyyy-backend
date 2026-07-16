-- Internal auth tables stay unreachable through Supabase browser roles.
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncCode" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny browser access" ON "Session"
    AS RESTRICTIVE FOR ALL TO anon, authenticated
    USING (false) WITH CHECK (false);

CREATE POLICY "Deny browser access" ON "SyncCode"
    AS RESTRICTIVE FOR ALL TO anon, authenticated
    USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE "Session" FROM anon, authenticated;
REVOKE ALL ON TABLE "SyncCode" FROM anon, authenticated;
