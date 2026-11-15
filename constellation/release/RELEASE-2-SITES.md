---
name: >-
  R2: Sites — binary-backed adapter, platform engine packages, magic sites from tools/list, magic
  sites theme dev|check
status: planned
connections:
  - DECISION-SITES-VIA-BINARY-ADAPTER
  - RELEASE-1-LOGIN
  - RELEASE-3-APP-SDK
notes:
  - kind: decision
    text: >-
      2026-11-15: the R2 theme-folder commands are `magic sites theme init | check | migrate | dev`
      (was bare `magic sites dev|check`). Cory asked for `magic sites theme dev` and chose to move
      all four; a bare `magic sites dev` would be ambiguous beside `magic sites app dev`. The
      engine-side rename is recommended, not confirmed (DOC-OPEN-DECISIONS row 12).
---

# R2: Sites

Theme: bring Sites in without a second copy of its API.

## Scope

- **Lands in:** sites/engine — per-call token, `sites ops --json` and raw-JSON input, release tags and build matrix, module-path fix, and (recommended, not yet confirmed by Cory) the theme-folder operations renamed to `theme.*` ([[FEATURE-SITES-ENGINE-CHANGES]], [[DOC-OPEN-DECISIONS]] row 12).
- `@magic-spells/sites-engine-<os>-<arch>` packages and the pin-at-pack shim ([[FEATURE-SITES-ENGINE-PACKAGES]]).
- `packages/sites`: the binary-backed adapter, `magic sites …` built from `tools/list`, `magic sites theme dev|check` by shell-out, Sites tools in `magic mcp` ([[FEATURE-SITES-ADAPTER]]).

## Gate

- `magic sites pages list --workspace <handle>` lists pages using the key from `magic login`.
- `magic sites theme dev` serves a theme folder with live reload; `magic sites theme check` reports diagnostics with exit 7.
- `magic mcp` lists `sites_*` tools beside `pyramid_*`.

## Lead-time items (Cory)

- Tag the Sites engine release the CLI pins; approve publishing the engine binary publicly.
