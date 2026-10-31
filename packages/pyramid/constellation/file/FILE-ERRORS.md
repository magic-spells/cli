---
name: src/errors.ts
status: built
path: src/errors.ts
language: typescript
summary: McpError helpers + HTTP/envelope→code mapping.
connections:
  - DATATYPE-MCP-ERROR
  - DOC-ERROR-MODEL
---

Defines the `McpError` constructor/helpers and the mapping table ([[DOC-ERROR-MODEL]]) from
HTTP status + Pyramid envelope codes to [[DATATYPE-MCP-ERROR]] `code`s. Every tool returns
`{ content: [{ type: 'text', text: JSON }], isError: true }` carrying this shape — never a
raw throw to the transport.
