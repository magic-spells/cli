---
name: 'Sites adapter: magic sites … from the engine''s catalogue, dev|check by shell-out, Sites tools in magic mcp'
status: planned
release: RELEASE-2-SITES
change: feature
connections:
  - COMPONENT-SITES-ADAPTER
  - FLOW-SITES-ADAPTER-BOOT
  - API-SITES-OPS-CATALOGUE
  - DECISION-SITES-VIA-BINARY-ADAPTER
  - FEATURE-SITES-ENGINE-CHANGES
  - FEATURE-SITES-ENGINE-PACKAGES
---

# Sites adapter

## Scope

- `packages/sites` per [[COMPONENT-SITES-ADAPTER]] and [[FLOW-SITES-ADAPTER-BOOT]]: engine resolution, version check, catalogue cache, MCP client over the child, error map, one child per workspace.
- CLI shape: Sites' dotted names become `magic sites <noun> <verb>` (`magic sites pages list`, `magic sites theme push`); Sites' single positional "subject" maps to the first positional.
- `magic sites dev` and `magic sites check` by shell-out with inherited stdio, the session key in env.
- Human rendering for the common lists (pages, themes, entries) using the default table renderer.
- `sites_*` tools in `magic mcp`.

## Acceptance

- The R2 gate (`magic sites pages list`, `magic sites dev` on a theme folder).
- Every operation in `sites ops --json` with `cli` in `surfaces` appears in `magic sites --help`; every one with `mcp` appears in `tools/list`.
- A Sites `theme_diagnostics` failure exits 7 and prints the diagnostics.
