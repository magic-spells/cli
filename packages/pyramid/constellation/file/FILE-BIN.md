---
name: bin/pyramid.ts
status: built
path: bin/pyramid.ts
language: typescript
summary: 'Unified `pyramid` bin: version, local credentials, `mcp`/`doctor`, and CLI dispatch.'
connections:
  - FILE-SERVER
  - FILE-CONFIG
  - FLOW-STARTUP-AUTH
  - DOC-ONBOARDING
  - PLAN-PHASE-1-FOUNDATION
  - DOC-PACKAGE-RENAME
  - FILE-CLI
  - FILE-OPERATIONS
  - FILE-AUTH-COMMANDS
  - FILE-VERSION
---

`#!/usr/bin/env node` entry for the unified `@magic-spells/pyramid` package ([[DOC-PACKAGE-RENAME]]). Dispatches on argv:

- `pyramid version` / `v` / `-v` / `--version` -> print `pyramid <version>` from [[FILE-VERSION]] to stdout, before config load.
- `pyramid set-key` / `set-api-key` / `set-token` / `show-key` / `logout` / `login` -> local credential commands ([[FILE-AUTH-COMMANDS]]), handled before config load because they do not require an existing Pyramid API key. `login` is async: it starts the loopback callback server, opens the web app, then exits after success/failure.
- `pyramid mcp` -> load config and start the stdio MCP server ([[FILE-SERVER]]).
- `pyramid doctor` -> load config and run the auth/setup check ([[FLOW-STARTUP-AUTH]]).
- anything else, including no subcommand -> lazy-import and hand off to the CLI ([[FILE-CLI]]).

Reads the key via [[FILE-CONFIG]] (`env -> keychain -> error`) only on branches that need Pyramid API access. Both surfaces share one core and the operation registry ([[FILE-OPERATIONS]]). Diagnostics go to stderr; scriptable data and CLI/MCP payloads go to stdout according to the branch contract. Built to `dist/bin/pyramid.js`.
