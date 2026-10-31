---
name: reorder_stage / reorder_status
kind: mcp-tool
status: planned
methods:
  POST:
    response_schema: DATATYPE-WORKFLOW
connections:
  - FILE-TOOLS-COLLAB
  - FILE-OPERATIONS
  - DATATYPE-WORKFLOW
  - DOC-DESIGN-RULES
  - PLAN-PHASE-3-COLLAB-ADMIN
---

`reorder_stage` / `reorder_status` — change column order (PM/admin only). Wraps
`POST /v1/projects/{id}/stages/reorder` and `POST /v1/stages/{id}/statuses/reorder`.

- **At most ONE neighbor** (`before` XOR `after`; sending both → 422 — the server derives the other
  bound). Omit both to move to the end. Map a "between A and B" request to a single neighbor
  ([[DOC-DESIGN-RULES]] rule 7).
- **No bulk reorder** — "set this exact order A,B,C" is N sequential single-move calls (not atomic).
- A status is hard-scoped to its stage (can't move a status to another stage via reorder). Stage/status
  **categories are different enums** — don't conflate them. Returns the refreshed [[DATATYPE-WORKFLOW]].
