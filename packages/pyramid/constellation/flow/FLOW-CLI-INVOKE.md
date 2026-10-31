---
name: CLI command invocation
status: built
triggers:
  - kind: manual
connections:
  - FILE-BIN
  - FILE-CLI
  - FILE-OPERATIONS
  - FILE-RESOLVER
  - FILE-PYRAMID-CLIENT
  - DOC-CLI-OUTPUT
  - DATATYPE-CLI-OPTIONS
  - FILE-CONFIG
  - FLOW-CREDENTIAL-RESOLUTION
---

# CLI command invocation

End-to-end for e.g. `pyramid task move WEB-42 --status "In Review" --json`:

1. [[FILE-BIN]] sees argv[0] is not one of its built-ins (`version`, local credential commands, `mcp`, `doctor`) and lazy-imports [[FILE-CLI]].
2. [[FILE-CLI]] parses global flags ([[DATATYPE-CLI-OPTIONS]]) + the `task move` subcommand, builds the operation input from flags / positionals, and validates it against the op's zod schema. Mismatch -> usage error on stderr, exit 2.
3. Config loads through [[FILE-CONFIG]]: `PYRAMID_API_KEY` env -> OS keychain -> startup error ([[FLOW-CREDENTIAL-RESOLUTION]]). CLI globals such as `--base-url` / `--project` layer over the config where supported.
4. `operation.run` ([[FILE-OPERATIONS]]): [[FILE-RESOLVER]] turns `WEB-42` / `"In Review"` into UUIDs, [[FILE-PYRAMID-CLIENT]] calls Pyramid as the key's user, and the response is hydrated.
5. The renderer emits JSON (forced, or because stdout is not a TTY) or human output, then exits `0`. Any [[DATATYPE-MCP-ERROR]] -> typed code + matching non-zero exit ([[DOC-CLI-OUTPUT]]).

Identical to the MCP path from step 4 onward — same resolver, same client, same invariants; only argv/rendering differs from JSON-RPC/tool-result handling.
