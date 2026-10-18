---
name: 'MCP aggregator: magic mcp with product prefixes, --products, auth isolation'
status: planned
release: RELEASE-0-SCAFFOLD-AND-BASE
change: feature
connections:
  - COMPONENT-MCP-AGGREGATOR
  - DECISION-ONE-MCP-SERVER
  - FLOW-MCP-TOOL-CALL
  - ROLE-AGENT
---

# MCP aggregator

## Scope

- `magic mcp [--products a,b]` per [[COMPONENT-MCP-AGGREGATOR]]; R0 with Pyramid only, built so R2 adds Sites by registering a product.
- Family preamble + per-product instructions; prefixed resources and prompts.
- Signal and stdin-close handling from pyramid-cli's `bin/pyramid.ts`.

## Acceptance

- `claude mcp add magic -- npx -y @magic-spells/cli mcp` then `tools/list` shows `pyramid_*` tools only.
- With no Pyramid credential, `tools/list` still lists them and a call returns `isError` with code `not_logged_in`.
- Nothing but JSON-RPC is written to stdout (a test pipes stdout through a JSON-RPC parser for a full session).
