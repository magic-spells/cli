---
name: 'Operations are the contract: each product exports an operation registry; CLI and MCP are two front-ends'
status: built
connections:
  - DECISION-OPERATION-CONTRACT
  - DECISION-ONE-MCP-SERVER
  - DECISION-SITES-VIA-BINARY-ADAPTER
  - DECISION-PYRAMID-CLI-IS-THE-BASE
  - COMPONENT-OPERATION-REGISTRY
  - COMPONENT-SHELL
  - COMPONENT-MCP-AGGREGATOR
  - DATATYPE-OPERATION
  - DOC-OPERATION-AUTHORING
  - FLOW-RUN-OPERATION
  - FLOW-MCP-TOOL-CALL
notes:
  - kind: state
    text: >-
      2026-10-31: implemented since magic-spells 0.1.0 — each product exports a ProductModule; the
      shell and `magic mcp` derive from the same operation list. Only the native adapter kind exists
      so far; the binary-backed kind arrives with the Sites adapter (R2).
---

# Operations are the contract

## Context

Every product CLI in the family, built or planned, already follows "one registry → CLI + MCP" (research §1, "Pattern"). Sites recorded it as DECISION-CLI-MCP-SHARED-OPERATIONS (sites plan): operations are declared in `sites/engine/ops/ops.go`, registered in `ops/builtin/builtin.go`, and `cmd/sites/cli.go` and `cmd/sites/mcp.go` both render from the same list. pyramid-cli is the TypeScript twin: `src/operations/index.ts` declares `Operation { name, summary, input: zod object, run(input, ctx), meta?: { destructive, cli: { group, verb, positionals, aliases }, mcpTool } }` and one flat `operations[]`; `src/cli/index.ts` derives the command tree by introspecting zod; `src/mcp/server.ts` passes `input.shape` to the MCP SDK. Marketing's CLI copies the same layout. Three TypeScript packages share one shape by copying, not through a library.

## Decision

- Every product package exports one **operation registry**: a list of [[DATATYPE-OPERATION]] values plus a client factory and a manifest (product id, display name, credential kind). That is the whole plugin interface.
- The shell ([[COMPONENT-SHELL]]) derives commands, positionals and flags from each operation's zod input; [[COMPONENT-MCP-AGGREGATOR]] derives MCP tools from the same list. Operations know nothing about either front-end: no argv, no stdout, no MCP types.
- Two adapter kinds satisfy the same registry interface: **native TypeScript** (pyramid, marketing, app) and **binary-backed** (sites, later Wishlist), where the registry is built at start-up from a child binary's catalogue. The shell cannot tell them apart.
- Cross-product rules (naming, errors, exit codes, destructive gate, output, pagination, name resolution) are one decision: [[DECISION-OPERATION-CONTRACT]].

## Alternatives

- **Hand-written commands per front-end.** Rejected: the drift every product's own decision already rejected.
- **An OpenAPI-generated client per product.** Rejected for now: Sites has no OpenAPI (`sites/server/docs/api.md` is hand-written), and operations carry name resolution and hydration that an API spec does not.
- **Shell out to each product CLI for everything.** Rejected for the TypeScript products: they run in-process with no subprocess cost.

## Consequences

- Adding a command means adding an operation; [[DOC-OPERATION-AUTHORING]] is the one how-to.
- pyramid-cli's MCP tool names change (`list_my_tasks` → `pyramid_task_list_mine`); acceptable because Pyramid has not launched.
- The registry is testable without a terminal or an MCP client: operation tests call `run` with a fake context.
