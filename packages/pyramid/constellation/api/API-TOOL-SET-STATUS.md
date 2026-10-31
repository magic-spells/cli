---
name: set_task_status
kind: mcp-tool
status: planned
methods:
  POST:
    response_schema: DATATYPE-TASK-DETAIL
connections:
  - FILE-TOOLS-TASKS
  - FILE-OPERATIONS
  - DOC-DESIGN-RULES
  - PLAN-PHASE-2-CORE-TOOLS
---

`set_task_status` — change ONLY a task's status (no reordering). Input `{ task, status }` (`task` =
`WEB-42`/UUID; `status` = name or category, resolved to the project's status UUID →
[[DATATYPE-TASK-DETAIL]]).

Picks the right endpoint: with no placement it uses `PATCH /v1/tasks/{id}` (status_id) — the op does
a `GET` first to supply the required `If-Match` ETag, hiding the two-call dance; if the user also
specifies placement it routes to [[API-TOOL-MOVE-TASK]]. Returns the hydrated task with the new
`Stage: Status` and notes the `completed_at` change (only a `done`-category status sets it; `canceled`
does not). Assignment / labels / fields go through their own ops, not here.
