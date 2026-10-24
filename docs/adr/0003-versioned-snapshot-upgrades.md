# Versioned snapshot upgrades

Snapshot schema changes are non-destructive. Each schema bump ships a pure
`upgradeSnapshot` step (`src/workspace/snapshot.ts`, mirrored in the
frontend). Reads upgrade stored older snapshots in memory and always return the
current schema; the upgraded form is persisted on the next PUT.

PUT accepts only the current schema. An older `schemaVersion` is rejected with
`409 Conflict` ("Client outdated: snapshot schema N is no longer accepted")
before Ajv runs, because `removeAdditional` would otherwise strip the legacy
fields and lose data. The `409` is distinguished from a version conflict
("Cloud snapshot changed") by its message.

Schema 2 (multi-method brewing): machines get `method` instead of free-text
`type`, brews `espressoWeight` -> `brewWeight` plus `method`, and a `recipes`
collection is added. See the frontend ADR 0003 for the full decision.
