---
name: Create task (end-to-end)
status: built
triggers:
  - kind: manual
connections:
  - API-TOOL-CREATE-TASK
  - FILE-PYRAMID-CLIENT
  - FILE-RESOLVER
  - DATATYPE-CREATE-TASK-INPUT
  - DATATYPE-TASK-DETAIL
  - EXTERNAL-PYRAMID-API
---

# Create task (end-to-end)

Representative end-to-end mutation (the "create these tasks in ready-for-design" prompt).

1. AI calls `create_task` ([[API-TOOL-CREATE-TASK]]) with [[DATATYPE-CREATE-TASK-INPUT]] (all
   names).
2. [[FILE-RESOLVER]] resolves `project` → id, then `stage`/`status`/`owner`/`labels` within
   that project ([[FLOW-NAME-RESOLUTION]]).
   - `stage` without `status` → first status of the stage by position
   - inconsistent stage+status → `status_not_in_stage`
3. [[FILE-PYRAMID-CLIENT]] `POST /v1/projects/{id}/tasks` against [[EXTERNAL-PYRAMID-API]]
   with bearer auth.
   - 4xx envelope → mapped [[DATATYPE-MCP-ERROR]] ([[DOC-ERROR-MODEL]])
4. Response hydrated into [[DATATYPE-TASK-DETAIL]] (status/stage/owner names alongside UUIDs,
   derived `WEB-42` key) and returned to the AI.
