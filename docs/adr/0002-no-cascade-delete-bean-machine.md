# Bean/Machine deletes never cascade-delete Brews

Context: frontend #19 requires "parent deletes never cascade-delete historical brews." The current schema has `onDelete: Cascade` on `Brew.bean`/`Brew.machine`, and `Brew.beanId`/`machineId` are required (non-nullable) `Int` columns.

Decision: drop `onDelete: Cascade` in favor of `onDelete: Restrict` (or no action). Deleting a Bean/Machine is a soft-delete — the row stays in place, signaled as deleted via a `Change` entry (ADR-0001) — so `beanId`/`machineId` never dangle and never need to become nullable.

Why: preserves full historical context on a brew (which bean/machine it used) even after that bean/machine is "deleted," instead of severing the link (nullable FK + SetNull) or hard-deleting history the moment a parent is removed. Matches how deletion already works for every other synced entity — the Change log is the delete signal, not a row disappearing.

Considered: nullable `beanId`/`machineId` with `onDelete: SetNull` — rejected because it permanently loses which bean/machine a historical brew used.
