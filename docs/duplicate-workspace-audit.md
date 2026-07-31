# Duplicate workspace audit

No automatic workspace deletion or merging is performed. A workspace is an
internal `User` row; its sync code is stored only as a hash, so duplicate rows
cannot be inferred from the code.

Operators must receive an explicit owner-supplied list of candidate workspace
IDs, then run this read-only report against the production database:

```sql
SELECT
  u.id,
  u.created_at,
  u.snapshot_version,
  COUNT(DISTINCT s.id) FILTER (WHERE s.revoked_at IS NULL) AS active_sessions,
  (u.snapshot IS NOT NULL) AS has_snapshot,
  COUNT(DISTINCT b.id) AS bean_rows,
  COUNT(DISTINCT m.id) AS machine_rows,
  COUNT(DISTINCT w.id) AS brew_rows
FROM "User" u
LEFT JOIN "Session" s ON s.user_id = u.id
LEFT JOIN "Bean" b ON b.user_id = u.id
LEFT JOIN "Machine" m ON m.user_id = u.id
LEFT JOIN "Brew" w ON w.user_id = u.id
WHERE u.id = ANY($1::int[])
GROUP BY u.id, u.created_at, u.snapshot_version, u.snapshot;
```

`$1` is supplied by the operator. The report is evidence for an explicit
cleanup decision; it does not alter workspace, session, or application data.
