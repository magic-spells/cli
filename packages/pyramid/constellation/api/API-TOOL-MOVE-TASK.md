---
name: move_task
kind: mcp-tool
status: built
methods:
  POST:
    request_schema: DATATYPE-MOVE-TASK-INPUT
    response_schema: DATATYPE-TASK-DETAIL
connections:
  - FILE-TOOLS-TASKS
  - DOC-DESIGN-RULES
  - PLAN-PHASE-2-CORE-TOOLS
---

`move_task` — change a task's status (stage derived) and/or ordering
([[DATATYPE-MOVE-TASK-INPUT]] → [[DATATYPE-TASK-DETAIL]]). Wraps `PATCH /v1/tasks/{id}/move`
(**no If-Match**). Positions are server-generated — pass `after_task`/`before_task` names,
never a fractional key ([[DOC-DESIGN-RULES]] rule 6); the client sends the resolved neighbors
as `after_id`/`before_id` and `status` as `status_id`. The endpoint returns an envelope
`{task, previous}` — hydrate `raw.task`, not the envelope ([[DOC-BACKEND-CONTRACT]]).
