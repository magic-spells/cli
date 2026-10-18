# Magic CLI — rules for coding agents

`magic` is the one public command line and MCP server for Magic Spells' hosted services: Sites, Pyramid,
Marketing, the Sites App SDK and Account. It is NOT for the open-source frameworks (Puzzle, puzzle-pieces,
Open Sourcery components keep their own CLIs and dev workflows). Cory 2026-10-18: "puzzle is its own project
and dev workflow, magic CLI is for magic spells services and products, not open source frameworks" and "it's
better to have one CLI that does everything than have 4 CLIs for each project."

## Shape (decided 2026-10-18)
- One published package `@magic-spells/cli`, one binary `magic`, one MCP server `magic mcp`. Product packages
  live in this monorepo and are never published on their own. The Pyramid CLI moves in as the base and the old
  `@magic-spells/pyramid` package is deprecated on npm and its repo archived — no migration period, Pyramid has not
  launched (Cory 2026-10-18: "we can deprecate and archive pyramid CLI after this, pyramid isn't even launched yet").
- TypeScript, Node 24 (`engines >=24`, `.nvmrc`), public on npm. Reference: Shopify/cli (MIT, oclif).
- Top level = the person and the family: `magic login | logout | whoami | doctor | mcp`. Products are namespaces:
  `magic pyramid …`, `magic sites …`, `magic app …`, `magic marketing …`.
- Base = the Pyramid CLI (`pyramid/pyramid-cli`, `@magic-spells/pyramid`): its operations layer, config, keychain,
  errors, render, hydrate and cache modules become the shared core. CLI and MCP are two front-ends over one
  operations list per product; the operations layer knows nothing about either front-end.
- The Go Sites engine ships as per-platform binary dependencies (the esbuild/wrangler pattern) for `magic sites
  dev|check`; everything else talks to each product's HTTP API with an Account-issued token from `magic login`.

## Working rules
- The plan is `constellation/` (cards); `.constellation/working.md` is session memory (gitignored). Plans live
  in cards, not docs. Read `research/MAGIC-CLI-BRIEF.md` before authoring cards.
- Vocabulary: workspace (never organization); handle (never slug); never name other platforms in cards except
  DOC-REFERENCE-MODELS; never name clients.
- Release-branch workflow; never tag or publish; never commit to main after the first release branch exists.
- Opus builds and reviews; Codex for backend/API-shaped work; no Fable sub-agents unless Cory says so.
