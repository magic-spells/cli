---
name: Phase 1 — Foundation
status: built
connections:
  - PLAN-PROJECT
---

# Phase 1 — Foundation

Goal: a runnable, stateless MCP/CLI package that authenticates, can answer `doctor`, and provides the core infrastructure used by every operation.

Delivered:
1. Package scaffold — `package.json` (ESM, `bin` -> `dist`, `files: ["dist"]`), `tsconfig.json`, vitest. See [[DOC-PACKAGING]].
2. Config loader [[FILE-CONFIG]] -> [[DATATYPE-MCP-CONFIG]] with `PYRAMID_API_KEY` env -> keychain -> error resolution.
3. Pyramid HTTP client [[FILE-PYRAMID-CLIENT]] — `undici`, bearer auth, error-envelope -> [[DATATYPE-MCP-ERROR]] mapping ([[DOC-ERROR-MODEL]]).
4. Name resolver + LRU cache [[FILE-RESOLVER]] ([[DOC-NAME-RESOLUTION]]).
5. Error helpers [[FILE-ERRORS]].
6. Server bootstrap [[FILE-SERVER]] + entry [[FILE-BIN]] ([[FLOW-STARTUP-AUTH]]).
7. `doctor` — MCP prompt plus `pyramid doctor` CLI branch: validates auth, prints the user + accessible projects, and pings the workflow endpoint.
8. Local setup helpers: `pyramid set-key`, `show-key`, `logout`, reserved `login`, and `version` ([[FILE-AUTH-COMMANDS]], [[FILE-VERSION]]).

Built and covered by unit/build/package checks. A live `pyramid doctor` smoke with a real key is still the step that would move this from built to verified.
