---
name: add_comment
kind: mcp-tool
status: built
methods:
  POST:
    request_schema: DATATYPE-ADD-COMMENT-INPUT
    response_schema: DATATYPE-COMMENT
connections:
  - FILE-TOOLS-COMMENTS
  - DOC-DESIGN-RULES
  - PLAN-PHASE-2-CORE-TOOLS
---

`add_comment` — post a root comment on a task ([[DATATYPE-ADD-COMMENT-INPUT]] →
[[DATATYPE-COMMENT]]). Stage-scoped: `stage` defaults to the task's current stage
([[DOC-DESIGN-RULES]] rule 4). Resolves `mentions` to user UUIDs. Wraps
`POST /v1/tasks/{id}/comments`.
