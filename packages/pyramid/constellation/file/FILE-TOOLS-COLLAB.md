---
name: future collaboration/admin operations
status: planned
path: src/operations/index.ts
language: typescript
summary: Future Phase-3 collaboration/admin operations; not present in the shipped registry.
connections:
  - DOC-TOOLS-COLLAB
  - PLAN-PHASE-3-COLLAB-ADMIN
---

Future Phase-3 collaboration/admin operations. There is no shipped `src/tools/collab.ts`; when
these land, they should be implemented as operations in [[FILE-OPERATIONS]] and registered through
[[FILE-SERVER]], matching the current registry architecture. See [[DOC-TOOLS-COLLAB]] /
[[PLAN-PHASE-3-COLLAB-ADMIN]].
