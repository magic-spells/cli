---
name: Architecture
kind: guide
status: built
connections:
  - EXTERNAL-PYRAMID-API
  - DOC-NAME-RESOLUTION
  - DOC-ERROR-MODEL
  - FILE-OPERATIONS
  - FILE-CLI
  - DOC-CLI
  - DOC-RENDERING
  - DOC-CREDENTIAL-STORAGE
  - DATATYPE-MCP-CONFIG
---

# Architecture

One **surface-agnostic core**, two thin skins. The core is built once; the MCP and CLI render from it ([[DOC-CLI]], [[DOC-PACKAGE-RENAME]]).

**Core layers** (AI client / terminal -> Pyramid over HTTPS bearer):
1. **Operation registry** — [[FILE-OPERATIONS]]. Each operation = `{ name, zod input, run(input, ctx) }`; `run` holds Pyramid logic: name resolution ([[FILE-RESOLVER]]), the [[FILE-PYRAMID-CLIENT]] call, output hydration, and invariants ([[DOC-DESIGN-RULES]]). The `API-TOOL-*` cards are these operations.
2. **Name resolver + cache** — [[FILE-RESOLVER]]: names -> UUIDs, 60s LRU per `(project, kind)` ([[DOC-NAME-RESOLUTION]]).
3. **Pyramid client** — [[FILE-PYRAMID-CLIENT]]: typed `undici`, bearer auth, error-envelope -> [[DATATYPE-MCP-ERROR]] ([[DOC-ERROR-MODEL]]).

**Skins:**
- **MCP** — [[FILE-SERVER]] maps each operation to `server.tool(name, input, run)`, adds resources + prompts + the `instructions` render recipe ([[DOC-RENDERING]]). Speaks stdio.
- **CLI** — [[FILE-CLI]] maps the same operations to `pyramid <group> <verb>` ([[DOC-CLI]]). It adds argv parsing and rendering, not separate Pyramid logic.
- **Bin/lifecycle** — [[FILE-BIN]] dispatches `version`, local credential commands, `mcp`, `doctor`, and CLI handoff.

**Why an MCP / CLI and not raw HTTP for agents?** They hallucinate routes, drop UUIDs mid-reasoning, and retry unrecoverable 4xx. A small, name-based, hydrated, typed-error operation surface removes those failure modes ([[DOC-DESIGN-RULES]]).

**State model.** No database and no persisted app data. Runtime state is limited to the resolver TTL cache. Credential storage is delegated to [[DOC-CREDENTIAL-STORAGE]]: env override first, then OS keychain/file fallback for the local `pyk_` key, read by [[FILE-CONFIG]].
