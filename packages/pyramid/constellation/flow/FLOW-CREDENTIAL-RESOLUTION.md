---
name: Credential resolution (env → keychain → error)
status: built
triggers:
  - kind: manual
connections:
  - FILE-CONFIG
  - FILE-KEYCHAIN
  - DOC-CREDENTIAL-STORAGE
  - FLOW-STARTUP-AUTH
  - DATATYPE-MCP-CONFIG
  - FILE-AUTH-COMMANDS
---

# Credential resolution (env -> keychain -> error)

How `pyramid mcp`, `pyramid doctor`, and ordinary CLI commands obtain the API key at startup ([[FILE-CONFIG]] `loadConfig`):

1. `PYRAMID_API_KEY` set + non-empty -> use it. This is the override for CI, headless MCP clients, and explicit `env` injection.
2. Else read the OS keychain via [[FILE-KEYCHAIN]] `getKey()` (synchronous). A hit -> use it.
   - macOS may prompt once to allow access; a miss, locked keychain, or headless failure returns `null`.
3. Still nothing -> throw a plain one-line startup error telling the user to set `PYRAMID_API_KEY`, run `pyramid login`, or store a key with `pyramid set-key <pyk_...>`.
4. Validate the `pyk_` prefix regardless of source -> [[DATATYPE-MCP-CONFIG]].

The write path is separate and interactive: `pyramid login` opens the web browser and stores the returned key; `pyramid set-key <pyk_...>` stores a manually pasted key; `pyramid logout` -> `deleteKey`; `pyramid show-key` reports masked status ([[FILE-AUTH-COMMANDS]], [[DOC-CREDENTIAL-STORAGE]]).
