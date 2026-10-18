---
name: 'MCP aggregator: magic mcp — one stdio server, product-prefixed tools, --products filter, per-product auth isolation'
kind: server
status: planned
framework: typescript
connections:
  - DECISION-ONE-MCP-SERVER
  - DECISION-OPERATIONS-ARE-THE-CONTRACT
  - COMPONENT-OPERATION-REGISTRY
  - COMPONENT-KIT
  - COMPONENT-SITES-ADAPTER
  - FEATURE-MCP-AGGREGATOR
  - FLOW-MCP-TOOL-CALL
  - ROLE-AGENT
---

# MCP aggregator

Generalises pyramid-cli's `src/mcp/server.ts`: walk the registry, register each operation as a tool (name = operation name with `_`, description = `summary`, input schema = the zod shape), parse arguments with the operation's schema, run, return JSON text, or an `isError` result carrying [[DATATYPE-ERROR-ENVELOPE]]. Built on `@modelcontextprotocol/sdk`.

## Behaviour

- `magic mcp [--products a,b]`: products are loaded at start; a binary-backed product that cannot start (no engine for this platform) is left out with one stderr line.
- Instructions: a short family preamble plus each product's own text under a heading (Pyramid's rendering rules move verbatim).
- Resources and prompts are prefixed per product (`pyramid://…`).
- Auth isolation: a product with no session still lists its tools; its calls return `not_logged_in`.
- stdout is JSON-RPC only; logs go to stderr. SIGINT/SIGTERM and stdin close shut down children (the Sites engine) and exit 0, as pyramid-cli does.
