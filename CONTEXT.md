# Coffyyy Backend

NestJS/Prisma API for Coffyyy's local-first durable-enrollment and workspace
snapshot sync.

## Domain

**Workspace**: Internal `User` row owning auth state and one current snapshot.

**Snapshot**: Complete JSON document containing beans, machines, brews, stable
local IDs, and brew relationships. Snapshot PUT replaces cloud state atomically
with an `If-Match` version guard.

**Sync code**: Reusable reconnect credential. Plaintext exists only in the
request/response path; the database stores its hash.

## Decisions

- Local data is the frontend source of truth; cloud sync is opt-in.
- GET/PUT workspace snapshot are the only application-data routes.
- Auth uses cookie sessions and CSRF protection. Reconnect pairs with the
  existing sync code and never creates a workspace implicitly.
- Snapshot replacement is last-write-wins only when the expected version
  matches; an equivalent retry is idempotent and a different stale write gets
  `409 Conflict`.
- Legacy operation push, change feeds, recovery history, migration import,
  entity CRUD routes, revisions, tombstones, and retention are removed.
- Existing User, Bean, Brew, and Machine rows survive the cleanup migration.
  Duplicate workspaces are never deleted automatically; use the documented
  owner-scoped read-only audit before any explicit cleanup.
