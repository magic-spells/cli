---
name: 'R2: Sites — binary-backed adapter, platform engine packages, magic sites from tools/list, magic sites dev|check'
status: planned
connections:
  - DECISION-SITES-VIA-BINARY-ADAPTER
  - RELEASE-1-LOGIN
  - RELEASE-3-APP-SDK
---

# R2: Sites

Theme: bring Sites in without a second copy of its API.

## Scope

- **Lands in:** sites/engine — per-call token, `sites ops --json` and raw-JSON input, release tags and build matrix, module-path fix ([[FEATURE-SITES-ENGINE-CHANGES]]).
- `@magic-spells/sites-engine-<os>-<arch>` packages and the pin-at-pack shim ([[FEATURE-SITES-ENGINE-PACKAGES]]).
- `packages/sites`: the binary-backed adapter, `magic sites …` built from `tools/list`, `magic sites dev|check` by shell-out, Sites tools in `magic mcp` ([[FEATURE-SITES-ADAPTER]]).

## Gate

- `magic sites pages list --workspace <handle>` lists pages using the key from `magic login`.
- `magic sites dev` serves a theme folder with live reload; `magic sites check` reports diagnostics with exit 7.
- `magic mcp` lists `sites_*` tools beside `pyramid_*`.

## Lead-time items (Cory)

- Tag the Sites engine release the CLI pins; approve publishing the engine binary publicly.
