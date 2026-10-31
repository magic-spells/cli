---
name: src/client/pyramid-client.ts
status: built
path: src/client/pyramid-client.ts
language: typescript
summary: Typed undici wrapper over the Pyramid API with bearer auth + error mapping.
connections:
  - EXTERNAL-PYRAMID-API
  - DOC-ERROR-MODEL
  - FILE-ERRORS
---

Typed `undici` wrapper around [[EXTERNAL-PYRAMID-API]] — one method per endpoint the tools
need (`getMe`, `listProjects`, `getWorkflow`, `listTasks`, `getTask`, `searchTasks`,
`createTask`, `bulkCreate`, `updateTask`, `moveTask`, `archiveTask`, `addComment`,
`replyComment`, …). Sets `Authorization: Bearer <apiKey>` + JSON headers on every request,
uses a keep-alive pool, and maps non-2xx envelopes to [[DATATYPE-MCP-ERROR]] via
[[FILE-ERRORS]] ([[DOC-ERROR-MODEL]]). Pagination is followed/surfaced, never silently
truncated ([[DOC-DESIGN-RULES]] rule 8).
