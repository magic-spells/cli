---
name: create_task
kind: mcp-tool
status: built
methods:
  POST:
    request_schema: DATATYPE-CREATE-TASK-INPUT
    response_schema: DATATYPE-TASK-DETAIL
connections:
  - FILE-TOOLS-TASKS
  - FLOW-CREATE-TASK
  - DOC-NAME-RESOLUTION
  - PLAN-PHASE-2-CORE-TOOLS
---

`create_task` — create one task from names ([[DATATYPE-CREATE-TASK-INPUT]] →
[[DATATYPE-TASK-DETAIL]]). Resolves project/stage/status/owner/labels ([[DOC-NAME-RESOLUTION]]);
if `stage` is given without `status`, picks the stage's first status by position; an
inconsistent pair → `status_not_in_stage`. Wraps `POST /v1/projects/{id}/tasks`. End-to-end in
[[FLOW-CREATE-TASK]].
