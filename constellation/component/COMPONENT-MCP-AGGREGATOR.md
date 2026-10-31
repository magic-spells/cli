---
name: 'MCP aggregator: magic mcp — one stdio server, product-prefixed tools, --products filter, per-product auth isolation'
kind: server
status: built
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
notes:
  - kind: decision
    text: >-
      No-key behaviour: a product without a key keeps its tools listed and each call answers
      not_logged_in, with one stderr line at start saying so (`magic mcp: pyramid: No Pyramid key
      found. Its tools answer not_logged_in until that is fixed. <hint>`). Why: it is this card's
      and FEATURE-MCP-AGGREGATOR's acceptance, the agent can tell the user what to do instead of
      seeing tools vanish, and the context resolves per call (kit ContextSource) and is kept once a
      key resolves, so `magic login --product-key` while the host is running works without a
      restart. Rejected: the part-1 reviewer's skip-the-product-with-a-stderr-line, because it hides
      the product from the agent and needs a host restart after login. Built:
      packages/cli/src/commands/mcp.ts (buildMcp + serveMcp); console.log/info/debug go to stderr
      before products load; SIGINT/SIGTERM/stdin end abort OpContext.signal, close the server, exit
      0; family preamble then each product's instructions under `## <title>`.
    sha: ad8cfdd
  - kind: gotcha
    text: >-
      When stdin closes, OpContext.signal is aborted and the process exits 0 at once, so any
      in-flight tool call is dropped rather than finished (accepted for R0: the host has already
      gone).
  - kind: state
    text: >-
      Supersedes "kept once a key resolves" in the decision note: the context is now built on every
      call (env and store read each time), so `magic logout` or a replaced key applies to a running
      server; tested. A product whose load() or mcp.register throws is left out with one stderr line
      (`magic mcp: <id>: left out (<message>)`): buildMcp guards load(), and createMcpServer
      dry-runs each product's registration on a scratch server and reports through onSkip, so the
      broken product's tools and instructions never reach the real server.
  - kind: state
    text: >-
      zod is 4.x (^4.6.7) across kit, pyramid and cli as of 0.2.1. Why: GHSA-mrhx-c7xc-m3w5 (zod <
      4.6.6 can exhaust memory validating oversized constrained collections) was the one high in npm
      audit, and magic-spells 0.2.0 bundled zod 3.25.76. @modelcontextprotocol/sdk 1.32.2 accepts
      zod ^3.25 || ^4, so no SDK change. Tool-input validation is unchanged: callTool still
      safeParses and turns the first issue into validation_failed with details.field = issue path
      joined by '.'. Only code change was argv.ts describeFields: zod 4 introspection reads
      schema.def.type (lowercase:
      optional/nullable/default/boolean/number/array/enum/object/record), def.innerType, def.element
      and def.entries instead of zod 3's _def.typeName. Flag derivation output is identical.
---

# MCP aggregator

Generalises pyramid-cli's `src/mcp/server.ts`: walk the registry, register each operation as a tool (name = operation name with `_`, description = `summary`, input schema = the zod shape), parse arguments with the operation's schema, run, return JSON text, or an `isError` result carrying [[DATATYPE-ERROR-ENVELOPE]]. Built on `@modelcontextprotocol/sdk`.

## Behaviour

- `magic mcp [--products a,b]`: products are loaded at start; a binary-backed product that cannot start (no engine for this platform) is left out with one stderr line.
- Instructions: a short family preamble plus each product's own text under a heading (Pyramid's rendering rules move verbatim).
- Resources and prompts are prefixed per product (`pyramid://…`).
- Auth isolation: a product with no session still lists its tools; its calls return `not_logged_in`.
- stdout is JSON-RPC only; logs go to stderr. SIGINT/SIGTERM and stdin close shut down children (the Sites engine) and exit 0, as pyramid-cli does.
