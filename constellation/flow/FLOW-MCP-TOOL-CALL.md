---
name: 'An agent calls a magic mcp tool'
status: planned
triggers:
  - kind: manual
connections:
  - COMPONENT-MCP-AGGREGATOR
  - COMPONENT-OPERATION-REGISTRY
  - COMPONENT-SITES-ADAPTER
  - DECISION-ONE-MCP-SERVER
  - DECISION-OPERATIONS-ARE-THE-CONTRACT
  - DATATYPE-ERROR-ENVELOPE
  - ROLE-AGENT
  - ROLE-MERCHANT-OPERATOR
---

# MCP tool call

1. **client**: started `npx -y @magic-spells/cli mcp [--products …]`; `initialize` returns the family preamble plus each product's instructions.
2. **client**: `tools/list` → every loaded product's operations with `surfaces` including `mcp`, named `<product>_<noun>_<verb>`, input schema from zod (or passed through from Sites).
3. **client**: `tools/call pyramid_task_next {…}`.
4. **aggregator**: find the operation; parse arguments with its schema (failure → `isError` with `validation_failed`).
5. **aggregator**: destructive gate — `yes: true` in the arguments and `MAGIC_ALLOW_DESTRUCTIVE=1` in the server's environment.
6. **aggregator**: session for the product (as [[FLOW-RUN-OPERATION]] step 5); none → `isError` `not_logged_in` with the hint "run magic login in a terminal". Other products are unaffected.
7. **product**: `run`; for Sites the adapter forwards `tools/call theme_push` to the child and maps the result.
8. **aggregator**: result as JSON text, or `isError` with the envelope. Never throws to the transport.
