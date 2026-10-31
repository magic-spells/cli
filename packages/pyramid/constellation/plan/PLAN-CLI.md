---
name: CLI surface — pyramid command
status: built
connections:
  - PLAN-PROJECT
  - DOC-CLI
  - FILE-OPERATIONS
  - FILE-CLI
  - FLOW-CLI-INVOKE
  - PLAN-PHASE-1-FOUNDATION
---

# CLI surface — `pyramid` command

A second presentation surface over the same core, for the consumers MCP can't reach: humans
at a terminal, shell scripts / CI, and **shell-only agents** (a model with a Bash tool but no
MCP host) that need to fetch a task, do it, and report status. See [[DOC-CLI]].

Depends on the Phase-1 core ([[PLAN-PHASE-1-FOUNDATION]] — [[FILE-CONFIG]],
[[FILE-PYRAMID-CLIENT]], [[FILE-RESOLVER]], [[FILE-ERRORS]]) and the shared operation registry
[[FILE-OPERATIONS]], the seam both the MCP tools and the CLI render from. The CLI adds **no**
new Pyramid logic — it is an `argv → operation → render` adapter.

## Deliverables

1. [[FILE-OPERATIONS]] — factor out the per-operation `(name, zod input, run)` registry the
   MCP tools already need, so `server.tool(...)` and the CLI share one source of truth.
2. [[FILE-CLI]] — build the subcommand tree from that registry; argv + global flags
   ([[DATATYPE-CLI-OPTIONS]]); human/JSON rendering ([[DOC-CLI-OUTPUT]]).
3. `bin/pyramid.ts` dispatch ([[FILE-BIN]], [[DOC-PACKAGE-RENAME]]): `mcp` → stdio server;
   `doctor` → auth check; anything else → the CLI.
4. The agent-loop verbs: `pyramid task next`, `pyramid task update`, `pyramid task comment` —
   each `--json`-clean ([[FLOW-CLI-INVOKE]]).

## Exit criteria

`pyramid task next --json | jq` returns the caller's next task; `pyramid task update <KEY>
--status Done` round-trips against a live backend; `pyramid mcp` still serves the identical
tool surface. Non-TTY stdout defaults to JSON; exit code reflects the error class.

Buildable after Phase-1 lands the core; the registry step (1) is best done *with* the MCP
build so the tools render from it from day one rather than being retrofitted.
