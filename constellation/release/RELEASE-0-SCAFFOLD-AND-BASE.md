---
name: 'R0: Scaffold and base — monorepo, kit from pyramid-cli, magic pyramid, whoami/doctor/mcp with product keys, CI, npm on tag'
status: planned
connections:
  - DECISION-PYRAMID-CLI-IS-THE-BASE
  - DECISION-TYPESCRIPT-ON-NODE-24
  - DECISION-OPERATIONS-ARE-THE-CONTRACT
  - DECISION-PUBLIC-NPM-RELEASE-ON-TAG
  - RELEASE-1-LOGIN
---

# R0: Scaffold and base

Theme: make `magic` real with one product. Everything lands in this repo except the npm deprecation and the GitHub archive of pyramid-cli, which Cory does.

## Scope

- npm-workspaces monorepo on Node 24 with `packages/cli`, `packages/kit`, `packages/pyramid` ([[FEATURE-MONOREPO-SCAFFOLD]]).
- The kit extracted from pyramid-cli: config, keychain (still macOS `security` + file in R0), argv/flag derivation, render, errors, cache, MCP builder, doctor ([[FEATURE-KIT-EXTRACTION]]).
- pyramid-cli moved in with history, renamed to the operation contract, green ([[FEATURE-PYRAMID-MOVE]]).
- `magic whoami | doctor` per product and `magic login --product-key` / `magic logout` ([[FEATURE-WHOAMI-DOCTOR]]).
- `magic mcp` with the Pyramid tools prefixed ([[FEATURE-MCP-AGGREGATOR]]).
- CI and the publish-on-tag workflow ([[FEATURE-RELEASE-PIPELINE]]).
- `@magic-spells/pyramid` deprecated, `magic-spells/pyramid-cli` archived ([[FEATURE-DEPRECATE-PYRAMID-CLI]]).

## Gate

- `npx @magic-spells/cli pyramid task next` works with a `pyk_` key from `MAGIC_PYRAMID_KEY` or `magic login --product-key`.
- `claude mcp add magic -- npx -y @magic-spells/cli mcp` lists the Pyramid tools as `pyramid_*`.
- pyramid-cli's test suite passes inside `packages/pyramid`.

## Lead-time items (Cory)

- Create the GitHub repo `magic-spells/cli` and the npm automation token secret.
- Push the first `v*` tag; run `npm deprecate` on `@magic-spells/pyramid` and archive `magic-spells/pyramid-cli` after the gate.
