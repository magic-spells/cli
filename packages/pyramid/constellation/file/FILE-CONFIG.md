---
name: src/config.ts
status: built
path: src/config.ts
language: typescript
summary: Parses + validates startup config; resolves API key from env, then keychain.
connections:
  - DATATYPE-MCP-CONFIG
  - DOC-PACKAGING
  - FILE-KEYCHAIN
  - DOC-CREDENTIAL-STORAGE
  - FLOW-CREDENTIAL-RESOLUTION
---

Reads and validates configuration into [[DATATYPE-MCP-CONFIG]] once at startup; shared by both surfaces (MCP + CLI).

The API key resolves **`PYRAMID_API_KEY` env -> OS keychain -> error** ([[FLOW-CREDENTIAL-RESOLUTION]], [[FILE-KEYCHAIN]], [[DOC-CREDENTIAL-STORAGE]]). The keychain read is synchronous (`execFileSync`) so `loadConfig` stays sync. `loadConfig(env?, readKeychain?)` takes an injectable keychain reader so the resolution order is unit-testable without touching the real keychain.

Missing or invalid auth throws a plain, one-line `Error` (not an MCP error and not a stack dump); [[FILE-BIN]] / [[FILE-CLI]] render that to stderr and exit non-zero. The recovery path is to set `PYRAMID_API_KEY` or run `pyramid set-key <pyk_...>`. `baseUrl` defaults to `https://api.pyramid.magicspells.io`; `allowDestructive = PYRAMID_ALLOW_DESTRUCTIVE === '1'`. The key is never logged.
