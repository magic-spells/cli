---
name: 'App commands: the App SDK developer loop as magic app …'
status: planned
release: RELEASE-3-APP-SDK
change: feature
connections:
  - COMPONENT-APP-PACKAGE
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
  - EXTERNAL-SITES-APP-SDK
  - ROLE-DEVELOPER
---

# App commands

**Lands in:** this repo (`packages/app`) · sites-app-sdk (its cards change `sites app …` to `magic app …` and drop the alias) · sites/engine or sites-app-sdk for the local `check`/`dev` operations, as the App SDK plan decides

## Scope

- `packages/app` per [[COMPONENT-APP-PACKAGE]]: `init`, `dev`, `check`, `version`, `publish`, `install`, `logs`, `events replay`, `import`, with the semantics in the App SDK plan (COMPONENT-SITES-APP-CLI, FLOW-DEVELOPER-INIT-TO-PUBLISH there).
- `ak_` app keys from `MAGIC_APP_KEY` for CI; the Sites session from `magic login` otherwise.
- `app_*` tools in `magic mcp`.
- A note on the App SDK plan's COMPONENT-SITES-APP-CLI recording that `sites app …` never ships (developer-platform brief ruling 22 said "alias"; this plan's brief overrides it).

## Acceptance

- The R3 gate: the reference app goes init → dev site → publish through `magic app` alone.
- `magic app check --json` returns the validator's JSON-pointer problems with exit 7 when it fails.
