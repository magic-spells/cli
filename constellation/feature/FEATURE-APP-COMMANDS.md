---
name: 'App commands: the App SDK developer loop as magic sites app …'
status: planned
release: RELEASE-3-APP-SDK
change: feature
connections:
  - COMPONENT-APP-PACKAGE
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
  - EXTERNAL-SITES-APP-SDK
  - ROLE-DEVELOPER
notes:
  - kind: decision
    text: >-
      2026-11-15: reversed `magic app …` and the plan to change the App SDK plan's `sites app …` to
      it. The commands are `magic sites app …` (operations `sites.app.<verb>`, MCP `sites_app_*`),
      which is what the App SDK plan already says. Cory: “"magic app" should NEVER run something for
      sites” and “everything should be scoped, so "magic sites app"”.
---

# App commands

**Lands in:** this repo (`sites.app.*` operations through the Sites product module) · sites/engine or sites-app-sdk for the local `check`/`dev` operations, as the App SDK plan decides

## Scope

- Operations per [[COMPONENT-APP-PACKAGE]]: `init`, `dev`, `check`, `version`, `publish`, `install`, `logs`, `events replay`, `import` as `magic sites app <verb>`, with the semantics in the App SDK plan (COMPONENT-SITES-APP-CLI, FLOW-DEVELOPER-INIT-TO-PUBLISH there). The code's home (a separate internal `packages/app` the Sites module loads, or `packages/sites`) is settled when R3 is built.
- `ak_` app keys from `MAGIC_APP_KEY` for CI; the Sites session from `magic login` otherwise.
- `sites_app_*` tools in `magic mcp`.
- No spelling change in the App SDK plan: it already writes `magic sites app …`.

## Acceptance

- The R3 gate: the reference app goes init → dev site → publish through `magic sites app` alone.
- `magic sites app check --json` returns the validator's JSON-pointer problems with exit 7 when it fails.
