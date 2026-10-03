# Duplicate workspace audit

No automatic workspace deletion or merging is performed. A workspace is an
internal `User` row; its sync code is stored only as a hash, so duplicate rows
cannot be inferred from the code.

Operators must receive an explicit owner-supplied list of candidate workspace
IDs, then run this read-only report against the production database:

```sql
SELECT
  u.id,
  u."createdAt",
  u."snapshotVersion",
  COUNT(s.id) FILTER (WHERE s."revokedAt" IS NULL) AS active_sessions,
  (u.snapshot IS NOT NULL) AS has_snapshot,
  jsonb_array_length(COALESCE(u.snapshot -> 'beans', '[]')) AS beans,
  jsonb_array_length(COALESCE(u.snapshot -> 'machines', '[]')) AS machines,
  jsonb_array_length(COALESCE(u.snapshot -> 'brews', '[]')) AS brews
FROM "User" u
LEFT JOIN "Session" s ON s."userId" = u.id
WHERE u.id = ANY($1::int[])
GROUP BY u.id;
```

`$1` is supplied by the operator. The report is evidence for an explicit
cleanup decision; it does not alter workspace, session, or application data.
