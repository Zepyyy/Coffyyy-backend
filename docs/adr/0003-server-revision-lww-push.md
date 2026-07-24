# Server-revision last-write-wins push

Context: authenticated devices can push different versions of the same synced record concurrently.

Decision: update and delete operations carry `baseRevision`. The operation wins only when that revision still matches the live row. The server allocates a workspace-global revision for every operation, including losing operations. Losing operations are stored as `Change.accepted = false`; `/sync/changes` exposes accepted canonical changes, while `/sync/history` exposes the full seven-day recovery feed. Push acknowledgements return the canonical snapshot and revision.

Why: server-assigned revisions make ordering deterministic without device clocks. Keeping losing snapshots in the existing seven-day Change log makes conflict recovery possible while the accepted flag tells pull reconciliation which entries may become canonical state.
