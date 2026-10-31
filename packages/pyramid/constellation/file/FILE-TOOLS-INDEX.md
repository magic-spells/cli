---
name: src/mcp/server.ts tool registration
status: built
path: src/mcp/server.ts
language: typescript
summary: Tool registration now happens by walking the operation registry in src/mcp/server.ts.
connections:
  - FILE-SERVER
  - DOC-TOOLS-DISCOVERY
  - DOC-TOOLS-TASKS-READ
  - DOC-TOOLS-COMMENTS
  - FILE-TOOLS-TASKS
  - FILE-TOOLS-COMMENTS
  - FILE-TOOLS-DISCOVERY
---

There is no separate `src/tools/index.ts` in the shipped package. Tool registration is centralized
in [[FILE-SERVER]], which walks the flat [[FILE-OPERATIONS]] registry and registers each operation
as an MCP tool.

The old tool-family split is now represented as logical sections inside [[FILE-OPERATIONS]]:
discovery ([[FILE-TOOLS-DISCOVERY]]), tasks ([[FILE-TOOLS-TASKS]]), and comments
([[FILE-TOOLS-COMMENTS]]). Each operation still follows the same contract: zod input schema,
resolve names, call [[FILE-PYRAMID-CLIENT]], hydrate output, return typed errors.
