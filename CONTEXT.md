# Coffyyy Backend

NestJS/Prisma API for Coffyyy's local-first durable-enrollment and workspace
snapshot sync.

## Domain

**Workspace**: Internal `User` row owning auth state and one current snapshot.

**Snapshot**: Complete JSON document containing beans, machines (Brewers),
brews, recipes, stable local IDs, and their relationships. Snapshot PUT replaces
cloud state atomically with an `If-Match` version guard. Fields outside the
schema are stripped.

**Schema version**: `schemaVersion` of a snapshot, currently `2`. Older stored
snapshots are upgraded in memory on read (`upgradeSnapshot`) and persisted on
the next write; PUT accepts only the current version.

**Brew method**: `espresso | pour-over | moka`. Each machine has one; each brew
stores its own copy. Recipes exist for espresso and pour-over only, and a brew
linked to a recipe has the recipe's method.

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
- PUT of an older `schemaVersion` gets `409 Conflict` "Client outdated: ..."
  before schema validation, so legacy fields are never silently stripped.
- Legacy operation push, change feeds, recovery history, migration import,
  entity CRUD routes, revisions, tombstones, and retention are removed.
- No relational Bean/Brew/Machine tables: the server never queries workspace
  data, so the snapshot is its only storage. Revisit if cross-workspace
  features (sharing, server-side stats) appear.
- `src/workspace/snapshot.schema.ts` is the snapshot contract. `bun run
  openapi` copies it into `docs/openapi.json`; the frontend generates its
  types from that file. A spec fails if the two drift.
- Duplicate workspaces are never deleted automatically; use the documented
  owner-scoped read-only audit before any explicit cleanup.
