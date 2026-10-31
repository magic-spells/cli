---
name: list_task_references
kind: mcp-tool
status: planned
methods:
  POST:
    response_schema: DATATYPE-TASK-REFERENCE
connections:
  - FILE-TOOLS-COMMENTS
  - FILE-OPERATIONS
  - DOC-RENDERING
  - PLAN-PHASE-2-CORE-TOOLS
---

`list_task_references` — the git/PR drill-in. Wraps `GET /v1/tasks/{id}/references` →
[[DATATYPE-TASK-REFERENCE]][], partitioned into PRs / commits / branches for rendering
([[DOC-RENDERING]]). The API returns ALL refs unfiltered/unpaginated, so `type`/`status` filtering is
client-side. Tool description must state the truth: links are **webhook-sourced, read-only, may lag**,
and there's no live git query and no project-wide search — absence ≠ no activity. Also exposed via
`get_task(include=['references'])`.
