---
name: src/mcp/server.ts
status: built
path: src/mcp/server.ts
language: typescript
summary: 'MCP skin: builds the McpServer and registers each operation from the registry as a tool.'
connections:
  - FILE-OPERATIONS
  - FILE-RESOURCES
  - FILE-PROMPTS
  - DOC-ARCHITECTURE
  - FLOW-STARTUP-AUTH
  - FILE-BIN
  - DOC-RENDERING
---

The **MCP skin**. Builds the `McpServer` (`{ name, version, instructions }`) and registers tools by **walking the operation registry** ([[FILE-OPERATIONS]]) with `server.registerTool(...)` for each operation. It also wires read-only resources ([[FILE-RESOURCES]]) and prompts ([[FILE-PROMPTS]]).

Holds no Pyramid business logic. The shared `PyramidClient` ([[FILE-PYRAMID-CLIENT]]) + `Resolver` ([[FILE-RESOLVER]]) are passed in through the operation context. Tool handlers validate args with the operation's zod schema, run `op.run`, and return pretty JSON text; thrown values are coerced to the typed [[DATATYPE-MCP-ERROR]] envelope with `isError: true`.

The `instructions` string carries the render recipe ([[DOC-RENDERING]]): left-rail task cards, list-vs-detail, hydrated names, never auto-paginate, destructive confirmation, UTC dates, and “act on the error `code`, not the message.” Invoked by the `pyramid mcp` branch of [[FILE-BIN]].
