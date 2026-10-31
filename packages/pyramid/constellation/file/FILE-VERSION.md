---
name: src/version.ts
status: built
connections:
  - FILE-BIN
  - FILE-SERVER
path: src/version.ts
language: typescript
summary: >-
  Shared getVersion() — robust to dist vs tsx; used by the CLI version command + MCP
  serverInfo/instructions.
---

`getVersion()` — the package version, read once + cached. Shared so the CLI and MCP always report
the **same** number:

- CLI `pyramid version` (aliases `v` / `-v` / `--version`) → `pyramid <version>` on stdout ([[FILE-BIN]]).
- MCP `serverInfo.version` (advertised on `initialize`) + a `Pyramid MCP v<version>` prefix in the
  instructions string, so the model can report it ([[FILE-SERVER]]).

Walks **up** from this module's directory to the first `package.json`, so it resolves correctly
whether running **compiled** (`dist/src/version.js`) or **live via `tsx`** (`src/version.ts`) — this
fixed the earlier dist-only read that returned `0.0.0` under the `tsx` MCP config.
