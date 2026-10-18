---
name: 'App package (packages/app): the Sites App SDK''s developer commands as magic app …'
kind: product-package
status: planned
framework: typescript
connections:
  - COMPONENT-OPERATION-REGISTRY
  - COMPONENT-SITES-ADAPTER
  - FEATURE-APP-COMMANDS
  - EXTERNAL-SITES-APP-SDK
  - ROLE-DEVELOPER
---

# App package

The command set is the App SDK plan's (see [[COMPONENT-SITES-APP-CLI]] (sites-app-sdk plan)): `init | dev | check | version | publish | install | logs | events replay | import`. This card says only how they sit in `magic`.

- Operations named `app.<noun>.<verb>`; CLI `magic app <verb>` for the single-noun commands (`magic app publish`), `magic app events replay`.
- Remote commands call Sites' developer API (`/v1` developer routes) with the Sites session key from `magic login`, or an `ak_` app key from `MAGIC_APP_KEY` in CI.
- Local commands (`check`, `dev`) run where the App SDK plan puts them. If they stay in the Go engine's registry they reach `magic` through the Sites adapter's catalogue, re-homed under `app.*`; if the App SDK ships them in TypeScript (`@magic-spells/app-sdk`), they are native operations here. Which one is decided by the App SDK plan before R3.
- `sites app …` is never a spelling `magic` accepts.
