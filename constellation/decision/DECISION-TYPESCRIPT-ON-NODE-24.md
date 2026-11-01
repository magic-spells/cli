---
name: 'TypeScript on Node 24: ESM, engines >=24, .nvmrc 24, zod schemas'
status: built
connections:
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
  - DECISION-PYRAMID-CLI-IS-THE-BASE
  - FEATURE-MONOREPO-SCAFFOLD
  - COMPONENT-KIT
  - DATATYPE-OPERATION
notes:
  - kind: state
    text: >-
      2026-10-31: implemented since magic-spells 0.1.0 (ESM, engines >=24, .nvmrc 24). The "one zod
      major" rule was applied in 0.2.1: every workspace moved to zod 4 (^4.6.7) at once, so the
      body's "zod 3 today" is history. The keyring-binding consequence is still pending with
      FEATURE-KEYRING.
---

# TypeScript on Node 24

## Context

Cory, 2026-10-18: "should we build this in typescript so it's easy to run across multiple different systems?" → "ok so we'll want our CLI to be public then and use TS", and "we should be using Node 24 on everything".

The base, pyramid-cli, is already TypeScript ESM (`"type": "module"`, `tsc` build, `tsx` dev, vitest) with `engines.node >=22` and dependencies `@modelcontextprotocol/sdk ^1.12`, `undici ^6.19`, `zod ^3.23` (`pyramid/pyramid-cli/package.json`). Marketing's CLI has the same layout. Sites' CLI is Go and stays Go ([[DECISION-SITES-VIA-BINARY-ADAPTER]]).

## Decision

- TypeScript, ESM, compiled with `tsc` per workspace; tests with vitest; formatting with prettier (as pyramid-cli).
- Node 24: `engines.node >=24` in every package, `.nvmrc` = `24`, CI on Node 24 only.
- Operation inputs are zod schemas; zod stays on one major across every workspace (pyramid-cli and Marketing are both zod 3 today; the upgrade to a newer major is one change for all packages at once).
- No CLI framework dependency: the argv parser and flag derivation come from pyramid-cli's hand-rolled `src/cli/index.ts`, generalised in [[COMPONENT-KIT]].
- Built output is plain JS; the published package has no `tsx` or TypeScript runtime dependency.

## Alternatives

- **Go**, like the Sites engine and Puzzle. Rejected: Pyramid and Marketing are already TypeScript, npm is the zero-install path (`npx -y magic-spells`), and MCP clients register stdio servers through `npx` easily.
- **Keep Node 22.** Rejected by Cory's "Node 24 on everything".
- **Adopt a CLI framework** (as one of the reference CLIs does). Rejected: the registry already derives the command tree; a framework would add a second command model to keep in sync.

## Consequences

- People on Node 22 or older get an `engines` warning on install and a clear error from `magic` at start-up.
- Per-platform native code (the Sites engine) arrives as binaries in optional dependencies, never as a Node addon build step.
- The keyring binding must ship prebuilt binaries for Node 24 on macOS, Linux and Windows ([[DECISION-KEYRING-DEFAULT]]).
