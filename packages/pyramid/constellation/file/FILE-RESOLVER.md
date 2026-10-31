---
name: src/cache/resolver.ts
status: built
path: src/cache/resolver.ts
language: typescript
summary: Name→UUID resolution with a 60s LRU keyed by (project, kind).
connections:
  - DOC-NAME-RESOLUTION
  - DATATYPE-WORKFLOW
  - FILE-PYRAMID-CLIENT
  - FLOW-NAME-RESOLUTION
---

Name→UUID resolution with the precedence in [[DOC-NAME-RESOLUTION]] and a 60s LRU keyed by
`(project_id, kind)`, populated from the cached [[DATATYPE-WORKFLOW]]. Exposes
`resolveProject/Stage/Status/User/Label/Field/Task`; ambiguity throws an `ambiguous_*`
[[DATATYPE-MCP-ERROR]] with candidates; a miss throws `*_not_found` with close-match hints.
Invalidation hooks clear the relevant `(project,kind)` entry after a mutating op. See
[[FLOW-NAME-RESOLUTION]].
