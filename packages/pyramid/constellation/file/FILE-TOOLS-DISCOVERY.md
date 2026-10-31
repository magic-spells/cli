---
name: src/operations/index.ts discovery operations
status: built
path: src/operations/index.ts
language: typescript
summary: whoami / list_projects / get_project_workflow / list_my_tasks.
connections:
  - DOC-TOOLS-DISCOVERY
  - FILE-RESOLVER
---

Discovery operations live in [[FILE-OPERATIONS]] and are registered as tools by [[FILE-SERVER]]:
`whoami` ([[DATATYPE-WHOAMI]]), `list_projects`, `get_project_workflow` (via [[FILE-RESOLVER]]),
and `list_my_tasks`. See [[DOC-TOOLS-DISCOVERY]].
