---
name: 'App package: the Sites App SDK''s developer commands as magic sites app …'
kind: product-package
status: planned
framework: typescript
connections:
  - COMPONENT-OPERATION-REGISTRY
  - COMPONENT-SITES-ADAPTER
  - FEATURE-APP-COMMANDS
  - EXTERNAL-SITES-APP-SDK
  - ROLE-DEVELOPER
notes:
  - kind: decision
    text: >-
      2026-11-15: the App SDK commands moved from top-level `magic app …` (operations
      `app.<noun>.<verb>`, and "`sites app …` is never a spelling `magic` accepts") to `magic sites
      app …`, operations `sites.app.<verb>` registered through the Sites product module. Cory:
      “"magic app" should NEVER run something for sites” and “everything should be scoped, so "magic
      sites app"”. The App SDK plan already spells them `magic sites app …`, so both plans agree.
      Separate `packages/app` vs folding into `packages/sites` is left to R3.
---

# App package

The command set is the App SDK plan's (see [[COMPONENT-SITES-APP-CLI]] (sites-app-sdk plan)): `init | dev | check | version | publish | install | logs | events replay | import`. This card says only how they sit in `magic`.

- They are Sites commands: `magic sites app <verb>` (`magic sites app publish`, `magic sites app events replay`). There is no top-level `magic app`.
- The kit derives the command path and the MCP tool name from the operation name (`pyramid.task.list` → `magic pyramid task list` / `pyramid_task_list`), so the operations are named `sites.app.<verb>` (MCP `sites_app_<verb>`) and register through the Sites product module (product id `sites`). Whether the code stays a separate internal `packages/app` that the Sites module loads, or folds into `packages/sites`, is settled when R3 is built. So is `events replay`: `sites.app.events.replay` is four parts, and the kit's registry check allows three today.
- Remote commands call Sites' developer API (`/v1` developer routes) with the Sites session key from `magic login`, or an `ak_` app key from `MAGIC_APP_KEY` in CI.
- Local commands (`check`, `dev`) run where the App SDK plan puts them. If they stay in the Go engine's registry they reach `magic` through the Sites adapter's catalogue, re-homed under `sites.app.*`; if the App SDK ships them in TypeScript (`@magic-spells/app-sdk`), they are native operations here. Which one is decided by the App SDK plan before R3.
