---
name: 'One CLI for the hosted services: magic-spells, binary `magic`, products as namespaces'
status: planned
connections:
  - DECISION-NOT-FOR-FRAMEWORKS
  - DECISION-PYRAMID-CLI-IS-THE-BASE
  - DECISION-TYPESCRIPT-ON-NODE-24
  - DECISION-OPERATIONS-ARE-THE-CONTRACT
  - DECISION-ONE-MCP-SERVER
  - DECISION-PUBLIC-NPM-RELEASE-ON-TAG
  - COMPONENT-SHELL
  - DOC-COMMAND-TREE
  - FEATURE-MONOREPO-SCAFFOLD
  - ROLE-DEVELOPER
  - ROLE-MERCHANT-OPERATOR
  - ROLE-AGENT
notes:
  - kind: decision
    text: >-
      2026-10-18 (MAGIC-CLI-BRIEF ruling 1): one published package, one binary, one MCP server; product
      packages are npm workspaces inside this repo and are never published on their own.
---

# One CLI for the hosted services

## Context


Cory, 2026-10-18 (verbatim):

- "we might also want to start thinking about and planning a 'magic' CLI to go with this."
- "I think we'll also want the Magic CLI to support stuff for pyramid and Marketing and other things as well. should we build this in typescript so it's easy to run across multiple different systems?" → "ok so we'll want our CLI to be public then and use TS"
- "we can pull in pyramid here and use it as the base for our CLI. so they'll do 'magic whoami' and 'magic pyramid project list'" … "and then 'magic sites xxxx' and 'magic marketing xxxx'"
- "I think it's better to have one CLI that does everything than have 4 CLIs for each project."
- Repo: GitHub `magic-spells/cli`, folder `cli`, npm `magic-spells`, binary `magic`, product name "Magic CLI".

Today the family has a CLI per product, each built by copying the last (research §1): `sites` (Go, `pk_` keys, keychain service `dev.sites.cli`), `pyramid` (TypeScript, npm `@magic-spells/pyramid` 0.1.1, Pyramid keys (now `pyramid_`), service `pyramid`), `marketing` (TypeScript, unpublished, `pmk_`, service `magic-spells-marketing`), with `reviews` and `wishlist` planned the same way. None authenticates through Account. A person using three products installs three tools and pastes three keys.

## Decision

- One npm package `magic-spells`, one binary `magic`, one MCP server `magic mcp`. Public on npm, source public on GitHub, MIT like pyramid-cli.
- The top level belongs to the person and the family: `magic login | logout | whoami | doctor | mcp | upgrade` (plus `magic telemetry on|off`).
- Each product is a namespace: `magic pyramid …`, `magic sites …`, `magic app …` (the Sites App SDK), `magic marketing …`. Later products (Reviews, Wishlist) arrive as further namespaces, not further binaries.
- Product command packages are npm workspaces in this monorepo (`packages/pyramid`, `packages/sites`, `packages/app`, `packages/marketing`) bundled into the one published package. The only other published packages are the per-platform Sites engine binaries ([[DECISION-SITES-VIA-BINARY-ADAPTER]]).
- `magic whoami` answers "who am I and what can I reach": the Account identity plus the workspaces reachable in each product. `magic pyramid whoami` keeps its product meaning.

## Alternatives

- **A CLI per product** (today's path). Rejected by Cory: N installs, N logins, N update channels and N copies of the same keychain, render and error code.
- **A thin `magic` launcher dispatching to separate product binaries** (`magic-<product>` executables on PATH). Rejected for the TypeScript products: it keeps N packages to version and publish. The binary-backed adapter keeps that model only where a product's registry is not TypeScript (Sites).
- **Publish each product package separately and let the shell load them as plugins.** Rejected: one version for the whole CLI is simpler to support and nothing outside this repo needs the product packages.

## Consequences

- `@magic-spells/pyramid` is deprecated and its repo archived ([[DECISION-PYRAMID-CLI-IS-THE-BASE]]); Marketing's CLI never publishes on its own.
- The App SDK's `sites app …` spelling never ships; its commands land as `magic app …` ([[FEATURE-APP-COMMANDS]]). See [[COMPONENT-SITES-APP-CLI]] (sites-app-sdk plan).
- The CLI needs a login that works across products, which needs Account changes ([[DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY]]).
- One version line: a product that adds commands ships in the next `magic` release.
