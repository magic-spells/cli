---
name: 'MCP aggregator: magic mcp with product prefixes, --products, auth isolation'
status: built
release: RELEASE-0-SCAFFOLD-AND-BASE
change: feature
connections:
  - COMPONENT-MCP-AGGREGATOR
  - DECISION-ONE-MCP-SERVER
  - FLOW-MCP-TOOL-CALL
  - ROLE-AGENT
notes:
  - kind: state
    text: >-
      Built (a337923 + tests ad8cfdd): `magic mcp [--products a,b]` in
      packages/cli/src/commands/mcp.ts on the kit's createMcpServer, which now takes a per-product
      ContextSource (resolved per call, kept once a key resolves) and a family preamble (each
      product's instructions then sit under `## <title>`; ProductMcp.instructions is a function of
      the CLI version). Gates: cli/tests/mcp.test.ts — an MCP SDK Client over InMemoryTransport
      lists 17 pyramid_* tools, the pyramid_doctor prompt and pyramid:// resources; with no key the
      tools are listed and calls/resources answer not_logged_in, and a key stored afterwards is
      used; --products filters, an unknown id is usage; plus a full stdio session against `node
      packages/cli/bin/magic.js mcp` (initialize, tools/list, tools/call against a fake API) where
      every stdout line parses as JSON-RPC 2.0 and closing stdin exits 0. Not run: the real `claude
      mcp add` (by design, harness only). Decision on no-key behaviour recorded on
      COMPONENT-MCP-AGGREGATOR.
    sha: '2952966'
---

# MCP aggregator

## Scope

- `magic mcp [--products a,b]` per [[COMPONENT-MCP-AGGREGATOR]]; R0 with Pyramid only, built so R2 adds Sites by registering a product.
- Family preamble + per-product instructions; prefixed resources and prompts.
- Signal and stdin-close handling from pyramid-cli's `bin/pyramid.ts`.

## Acceptance

- `claude mcp add magic -- npx -y magic-spells mcp` then `tools/list` shows `pyramid_*` tools only.
- With no Pyramid credential, `tools/list` still lists them and a call returns `isError` with code `not_logged_in`.
- Nothing but JSON-RPC is written to stdout (a test pipes stdout through a JSON-RPC parser for a full session).
