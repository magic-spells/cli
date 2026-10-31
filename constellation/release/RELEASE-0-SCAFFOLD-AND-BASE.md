---
name: 'R0: Scaffold and base — monorepo, kit from pyramid-cli, magic pyramid, whoami/doctor/mcp with product keys, CI, npm on tag'
status: planned
connections:
  - DECISION-PYRAMID-CLI-IS-THE-BASE
  - DECISION-TYPESCRIPT-ON-NODE-24
  - DECISION-OPERATIONS-ARE-THE-CONTRACT
  - DECISION-PUBLIC-NPM-RELEASE-ON-TAG
  - RELEASE-1-LOGIN
notes:
  - kind: state
    text: >-
      All R0 code is on feat/r0-scaffold (2952966): scaffold, kit, Pyramid move, login
      --product-key/logout, whoami/doctor, magic mcp, CI + publish-on-tag, test type-check. Gates
      green locally against fake servers only: kit 110, pyramid 111 + 2 inherited skips, cli 27;
      build, typecheck, format:check, smoke:pack. What remains is Cory's: (1) create the GitHub repo
      magic-spells/cli and push; (2) add the NPM_TOKEN secret (automation token) and confirm the npm
      scope allows provenance from that repo; (3) merge feat/r0-scaffold into release/0.1.0, watch
      CI on three OSes; (4) the live gate — `magic pyramid task next` with a real pyk_ key and
      `claude mcp add magic -- npx -y @magic-spells/cli mcp` — never run by agents; (5) push the
      v0.1.0 tag; (6) after the gate, `npm deprecate @magic-spells/pyramid` and archive
      magic-spells/pyramid-cli (FEATURE-DEPRECATE-PYRAMID-CLI).
    sha: '2952966'
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
