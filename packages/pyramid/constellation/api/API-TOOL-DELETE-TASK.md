---
name: delete_task
kind: mcp-tool
status: built
methods:
  DELETE: {}
connections:
  - FILE-TOOLS-TASKS
  - FILE-OPERATIONS
  - DOC-DESIGN-RULES
  - PLAN-PHASE-2-CORE-TOOLS
---

`delete_task` — hard-delete a task by human key or UUID. This is a destructive operation and the
operation refuses to run unless `PYRAMID_ALLOW_DESTRUCTIVE=1` is present in [[DATATYPE-MCP-CONFIG]],
returning `destructive_action_disabled` otherwise.

The operation resolves the task reference, calls `DELETE /v1/tasks/{id}?hard=true` through
[[FILE-PYRAMID-CLIENT]], and the client supplies the required `If-Match` precondition via the
read-first ETag flow ([[DOC-CONCURRENCY]]). Returns `{ id, key, deleted: true }` on success.
