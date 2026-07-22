# Global per-user revision counter + unified Change log

Context: offline sync (frontend #18/#19) needs record-level last-write-wins by server-assigned monotonic order, change discovery for pull, delete tombstones, and 7-day recovery of losing versions — spanning Bean/Brew/Machine.

Decision: one monotonic `Revision` counter per User (workspace), shared across all synced entity types, plus a single append-only `Change` log (userId, entityType, Server ID, Client ID, revision, operation, payload snapshot) as the source of truth for pull, tombstones, and history. Purged after 7 days.

Why: a global counter gives pull a single "revision > N" cursor across entity types instead of unioning three per-table sequences. A unified log means tombstones and losing-version history share one write path and one purge job instead of two independently-maintained mechanisms (soft-delete columns plus a separate audit table) that would have to agree on ordering.

Considered: per-table revision columns with a separate delete/tombstone column and a separate audit-history table — rejected for the duplicated read/write/purge logic across three tables with no offsetting benefit.
