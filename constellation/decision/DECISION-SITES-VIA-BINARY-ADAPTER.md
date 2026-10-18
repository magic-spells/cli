---
name: 'Sites through its own binary: a binary-backed adapter drives `sites mcp`; the Go engine ships as per-platform npm packages'
status: planned
connections:
  - DECISION-OPERATIONS-ARE-THE-CONTRACT
  - DECISION-OPERATION-CONTRACT
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
  - COMPONENT-SITES-ADAPTER
  - COMPONENT-SITES-ENGINE-PACKAGES
  - FEATURE-SITES-ADAPTER
  - FEATURE-SITES-ENGINE-PACKAGES
  - FEATURE-SITES-ENGINE-CHANGES
  - API-SITES-OPS-CATALOGUE
  - FLOW-SITES-ADAPTER-BOOT
  - EXTERNAL-SITES
  - RELEASE-2-SITES
---

# Sites via a binary-backed adapter

## Context

Sites' operation registry is Go (`sites/engine/ops/ops.go`, `ops/builtin/builtin.go`, `ops/schema.go`); `sites mcp` (go-sdk v1.4.0) already exposes 59 tools with JSON Schemas as of 2026-10-16, and an operation never writes to stdout. `sites dev` is long-running and interactive (`r`+Enter refresh). There is no OpenAPI for `/v1` (only `sites/server/docs/api.md`). DECISION-CLI-MCP-SHARED-OPERATIONS (sites plan) rejected "a separate Node MCP package" because it drifts. Puzzle already ships a Go binary through npm: `bin/puzzle.js` picks `@magic-spells/puzzle-{darwin-arm64,darwin-x64,linux-x64,linux-arm64,win32-x64}` from optional dependencies, and `scripts/inject-platform-pins.mjs` pins them to the release version at pack time (research §1, §2).

The Go binary is not ready to be driven (research §2, §5.3): `SITES_TOKEN` is read only by `sites login`, never per call; there is no `ops --json` catalogue or raw-JSON input mode; no tags, no cross-compile matrix; and the module path is the repo root while the code is in `engine/`.

## Decision

- `packages/sites` is a **binary-backed adapter** ([[COMPONENT-SITES-ADAPTER]]): it spawns the bundled `sites mcp` over stdio as an MCP client, reads `tools/list`, and builds the Sites part of the registry from it (`theme.push` → `sites.theme.push`). Calls go through `tools/call`. `magic sites dev|check` shell out to `sites dev|check` with the terminal attached.
- No TypeScript copy of `/v1`.
- The engine ships as `@magic-spells/sites-engine-<os>-<arch>` optional dependencies of `@magic-spells/cli`, pinned to the CLI's version at pack time, copied from Puzzle's shim ([[COMPONENT-SITES-ENGINE-PACKAGES]]).
- The CLI owns credentials: it passes the Sites session key to the child per call (env), and the child never reads its own keychain blob when run by `magic`.
- **Lands in:** sites/engine — (a) a per-call token honoured at call time, (b) `sites ops --json` catalogue and a raw `--input '<json>'` mode ([[API-SITES-OPS-CATALOGUE]]), (c) release tags and a cross-compile build matrix, (d) the module-path fix for the `engine/` subfolder ([[FEATURE-SITES-ENGINE-CHANGES]]).
- Future Go products (Wishlist) use the same adapter kind.

## Alternatives

- **Re-implement Sites' ~45 API operations in TypeScript.** Rejected: drift, and nothing to generate from.
- **Subprocess `sites <op> --json` for every call.** Rejected as the main path: flags are re-parsed and there is no raw-JSON input. Kept for `dev` and `check`.
- **Import the Go module.** Not possible from TypeScript; also blocked by the module path and the private repo.
- **Download the binary on first run.** Rejected: optional dependencies work offline after install, pin the version and need no second update channel.

## Consequences

- Sites operations appear in `magic` only when the platform has an engine package; on an unsupported platform `magic sites …` fails with `product_unavailable` (exit 11).
- The Sites engine becomes a publicly downloadable binary built from a private repo (licence question in [[DOC-OPEN-DECISIONS]]).
- Start-up cost: the adapter spawns the child lazily, only when a `sites` command or tool is used, and caches the catalogue per engine version.
