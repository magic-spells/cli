---
name: archive_task / unarchive_task
kind: mcp-tool
status: built
methods:
  POST:
    response_schema: DATATYPE-TASK-DETAIL
connections:
  - FILE-TOOLS-TASKS
  - DOC-DESIGN-RULES
  - PLAN-PHASE-2-CORE-TOOLS
---

`archive_task` / `unarchive_task` — soft archive toggle. Input `{ task, archived: boolean }`; returns [[DATATYPE-TASK-DETAIL]]. Wraps `POST /v1/tasks/{id}/archive|unarchive`.

Hard [[API-TOOL-DELETE-TASK]] is a separate destructive tool gated behind
`PYRAMID_ALLOW_DESTRUCTIVE=1` ([[DOC-DESIGN-RULES]] rule 11).
