---
name: src/operations/index.ts task operations
status: built
path: src/operations/index.ts
language: typescript
summary: Task read + write tools.
connections:
  - API-TOOL-CREATE-TASK
  - API-TOOL-CREATE-TASKS-BULK
  - API-TOOL-UPDATE-TASK
  - API-TOOL-MOVE-TASK
  - API-TOOL-ARCHIVE-TASK
  - API-TOOL-DELETE-TASK
  - DOC-TOOLS-TASKS-READ
---

Task operations live in [[FILE-OPERATIONS]] and are registered as tools by [[FILE-SERVER]].

Read: `list_tasks`, `get_task`, `search_tasks` ([[DOC-TOOLS-TASKS-READ]]).
Write: [[API-TOOL-CREATE-TASK]], [[API-TOOL-CREATE-TASKS-BULK]], [[API-TOOL-UPDATE-TASK]],
[[API-TOOL-MOVE-TASK]], [[API-TOOL-ARCHIVE-TASK]], and [[API-TOOL-DELETE-TASK]]. Returns
[[DATATYPE-TASK-SUMMARY]] / [[DATATYPE-TASK-DETAIL]] for reads and mutations, with hard delete
returning `{ id, key, deleted: true }`.
