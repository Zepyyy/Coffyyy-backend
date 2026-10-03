# Snapshot-only storage and a backend-owned contract

The frontend's IndexedDB is the relational source of truth; the backend is
backup and transport between devices and never queries workspace data. The
legacy relational Bean, Brew, and Machine tables are dropped and the JSONB
snapshot is the only storage. Per-row sync (outbox, revisions, tombstones)
was tried and removed as too costly for this use.

The snapshot contract lives once, as JSON Schema in
`src/workspace/snapshot.schema.ts`. Ajv validates PUTs against it and strips
unknown fields; `bun run openapi` writes it into `docs/openapi.json`, and the
frontend generates its snapshot types from that file. A spec fails when the
document drifts from the schema.

Concurrent offline edits are merged on the client, per entity by `localId`,
against the last synced snapshot. Only edits to the same entity on both sides
surface as a conflict; the server contract (`If-Match` + `409`) is unchanged.

Revisit if cross-workspace features (sharing, server-side stats) appear.
