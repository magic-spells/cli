---
name: 'Sites engine changes for the adapter: per-call token, ops catalogue, raw input, release tags, module path'
status: planned
release: RELEASE-2-SITES
change: feature
connections:
  - API-SITES-OPS-CATALOGUE
  - DECISION-SITES-VIA-BINARY-ADAPTER
  - FEATURE-SITES-ADAPTER
  - EXTERNAL-SITES
---

# Sites engine changes

**Lands in:** sites/engine (`cmd/sites/cli.go`, `cmd/sites/mcp.go`, `ops/ops.go`, `internal/keychain`, `go.mod`, a release script) — the Sites engine plan gets its own cards when the work starts; cite COMPONENT-SITES-CLI and DOC-CLI-REFERENCE (sites engine plan) and DECISION-CLI-MCP-SHARED-OPERATIONS (sites plan).

## Scope

- (a) **Per-call token.** `SITES_TOKEN` honoured by every operation's credential resolution, ahead of site bindings and workspace keys, at call time; with it set, the keychain blob `dev.sites.cli` is never read or written. `SITES_API` already sets the host.
- (b) **Catalogue and raw input.** `sites ops --json` and `--input '<json>' | --input -` per [[API-SITES-OPS-CATALOGUE]]; `ops.Operation` gains `Destructive` and `RequiresSession`.
- (c) **Release.** Version tags on the Sites repo for the engine (`engine/vX.Y.Z`) and a cross-compile script for the five platforms (Puzzle's `scripts/release-prep.mjs` is the model); `sites version` prints the tag.
- (d) **Module path.** Make the engine importable and buildable from its subfolder: either a `go.mod` in `engine/` with module path `github.com/magic-spells/sites/engine`, or a documented `GOWORK=off` build from the repo root that the release script uses. Research §2 marks the `go install` failure as inferred; confirm before choosing.
- (e) **Theme-folder names — only if Cory confirms [[DOC-OPEN-DECISIONS]] row 12** (recommended, not yet confirmed). Rename `init`, `check`, `migrate`, `dev` and `dev.stop` in `ops/builtin/builtin.go` to `theme.init`, `theme.check`, `theme.migrate`, `theme.dev`, `theme.dev.stop`, so the adapter derives `magic sites theme …` from the catalogue; the engine's own commands become `sites theme init | check | migrate | dev`.

## Acceptance

- `SITES_TOKEN=pk_… sites pages list --json` works on a machine with no `sites login`.
- `sites ops --json` lists all 59+ operations with schemas and surfaces.
- A tagged engine build produces five binaries from CI.
