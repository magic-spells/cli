---
name: 'The Pyramid CLI is the base: its modules become the kit and packages/pyramid; @magic-spells/pyramid is deprecated and its repo archived'
status: planned
connections:
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
  - DECISION-OPERATIONS-ARE-THE-CONTRACT
  - DECISION-TYPESCRIPT-ON-NODE-24
  - COMPONENT-KIT
  - COMPONENT-PYRAMID-PACKAGE
  - FEATURE-KIT-EXTRACTION
  - FEATURE-PYRAMID-MOVE
  - FEATURE-DEPRECATE-PYRAMID-CLI
  - FLOW-MOVE-PYRAMID-CLI
  - EXTERNAL-PYRAMID
notes:
  - kind: gotcha
    text: >-
      pyramid-cli already has a browser login (`pyramid login`, src/auth-commands.ts): a loopback server on
      127.0.0.1 and Pyramid web's `/auth/cli` page, which mints a workspace-scoped `pyk_` through the web session
      (FLOW-CLI-BROWSER-LOGIN, pyramid-cli plan). The research survey lists only set-key/show-key/logout/doctor.
      It moves in as the R0 way to get a Pyramid key and is the precedent for the product session mint.
---

# The Pyramid CLI is the base

## Context

Cory, 2026-10-18: "we can pull in pyramid here and use it as the base for our CLI" and "we can deprecate and archive pyramid CLI after this, pyramid isn't even launched yet so it's fine".

pyramid-cli (`pyramid/pyramid-cli`, npm `@magic-spells/pyramid` 0.1.1, public repo `magic-spells/pyramid-cli`, MIT) is the most complete TypeScript CLI in the family: `src/operations/index.ts` (registry, 1226 lines), `src/cli/index.ts` (zod → argv, 582), `src/cli/render.ts` (table/JSON, exit codes), `src/mcp/{server,resources,prompts}.ts`, `src/client/pyramid-client.ts` (undici), `src/errors.ts` (McpError + HTTP envelope mapping), `src/keychain.ts` (macOS `/usr/bin/security`, service `pyramid`, 0600 file fallback), `src/config.ts` (env → keychain → error), `src/hydrate.ts`, `src/cache/resolver.ts`, `src/auth-commands.ts`, `bin/pyramid.ts`, with vitest tests and its own constellation plan.

## Decision

- The generic parts of pyramid-cli become the kit ([[COMPONENT-KIT]]): config, keychain, argv parsing and flag derivation, render, errors, the hydrate/cache primitives, the MCP server builder, the doctor framework.
- The Pyramid-specific parts become `packages/pyramid` ([[COMPONENT-PYRAMID-PACKAGE]]): operations, client, resolver, hydration rules, MCP instructions, resources and prompts.
- The move keeps history: pyramid-cli's commits are imported with a subtree-style merge into `packages/pyramid` before the split ([[FLOW-MOVE-PYRAMID-CLI]]).
- After R0 ships, `@magic-spells/pyramid` gets an `npm deprecate` message pointing at `@magic-spells/cli`, and `magic-spells/pyramid-cli` is archived on GitHub. No compatibility shim, no `pyramid` binary alias, no migration period.

## Alternatives

- **Start the kit fresh and port Pyramid later.** Rejected: pyramid-cli is built, tested and already has the registry shape.
- **Use Marketing's CLI as the base.** Rejected: same layout, but unpublished, fewer tests and no resolver.
- **Keep `@magic-spells/pyramid` alive as a re-export.** Rejected by Cory: Pyramid has not launched, so nobody needs a migration period.

## Consequences

- The pyramid-cli plan's FILE cards stop describing live code once the repo is archived; the Pyramid package's cards here replace them.
- Operation names, the env var for destructive actions and the keychain service change on the move ([[DECISION-OPERATION-CONTRACT]], [[DECISION-KEYRING-DEFAULT]]).
- `engines` moves from `>=22` to `>=24`.
