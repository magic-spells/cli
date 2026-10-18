---
name: 'One MCP server: `magic mcp` aggregates every product over stdio with product-prefixed tools and a --products filter'
status: planned
connections:
  - DECISION-OPERATIONS-ARE-THE-CONTRACT
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
  - COMPONENT-MCP-AGGREGATOR
  - FEATURE-MCP-AGGREGATOR
  - FLOW-MCP-TOOL-CALL
  - ROLE-AGENT
  - ROLE-MERCHANT-OPERATOR
  - DOC-OPEN-DECISIONS
---

# One MCP server

## Context

Three MCP servers exist or are planned per product: `sites mcp` (Go, 59 tools), `pyramid mcp` (`@modelcontextprotocol/sdk`, tool names snake_case without a prefix, model-facing INSTRUCTIONS text in `src/mcp/server.ts`, plus resources and prompts), Marketing's (10 tools). An agent working across products registers each one and holds each one's key. pyramid-cli's rule: on the MCP transport stdout is JSON-RPC only.

## Decision

- `magic mcp` is the only MCP server: one stdio server that registers every product's operations as tools named `<product>_<noun>_<verb>`.
- `--products pyramid,sites` limits which products' tools are listed; by default every product with a usable credential is listed.
- Auth is the keyring from `magic login`, or product-key environment variables for CI. A product whose credential is missing or expired still lists its tools; a call fails with `auth_invalid`/`not_logged_in` for that product only, and the other products keep working.
- Per-product server instructions (Pyramid's rendering rules) are concatenated under product headings; resources and prompts keep a product prefix.
- Registration: `claude mcp add magic -- npx -y @magic-spells/cli mcp`.
- Destructive tools need `yes: true` in the input and `MAGIC_ALLOW_DESTRUCTIVE=1` in the server's environment ([[DECISION-OPERATION-CONTRACT]]).
- A hosted HTTP MCP with OAuth is a later option, open in [[DOC-OPEN-DECISIONS]].

## Alternatives

- **One MCP server per product.** Rejected: N registrations and N credentials for one person.
- **Proxy `sites mcp` to the client unchanged.** Rejected as the only path: tool names would collide across products and auth would split. The Sites adapter proxies calls but the tool list is renamed and owned by `magic mcp`.

## Consequences

- Tool names change for Pyramid (prefix) and Sites (prefix); acceptable before launch.
- Large tool lists cost agents context; the `--products` filter is the answer, and the default could narrow later.
