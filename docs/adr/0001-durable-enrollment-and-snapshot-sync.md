# Durable enrollment and snapshot sync

The backend stores one current workspace snapshot and durable hashed sync-code
pairing credentials. Authenticated GET/PUT snapshot is the only application
data interface. PUT uses an `If-Match` snapshot version, is atomic, and treats
an equivalent retry as idempotent.

Operation outboxes, change feeds, recovery history, revisions, tombstones,
entity CRUD, and migration-import APIs are intentionally not supported.
