---
name: Name → ID resolution
status: built
connections:
  - FILE-RESOLVER
  - DOC-NAME-RESOLUTION
  - DATATYPE-WORKFLOW
  - DATATYPE-MCP-ERROR
---

# Name → ID resolution

1. A tool receives a name (e.g. project "MOGO", status "QA").
2. [[FILE-RESOLVER]] checks the LRU for `(project_id, kind)`.
   - miss → fetch [[DATATYPE-WORKFLOW]] via the client and populate (60s TTL)
3. Apply the precedence for that kind ([[DOC-NAME-RESOLUTION]]).
   - exactly one match → return its UUID
   - >1 match → throw `ambiguous_<kind>_name` with `candidates` ([[DATATYPE-MCP-ERROR]])
   - 0 matches → throw `<kind>_not_found` with close-match `candidates`/`hint`
4. The tool proceeds with resolved UUIDs; after a mutating op it invalidates the affected
   `(project,kind)` cache entry.
