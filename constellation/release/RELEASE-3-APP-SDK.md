---
name: >-
  R3: App SDK — magic sites app init | dev | check | version | publish | install | logs | events
  replay | import
status: planned
connections:
  - RELEASE-2-SITES
  - RELEASE-4-MARKETING-TELEMETRY-UPGRADE
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
notes:
  - kind: decision
    text: >-
      2026-11-15: reversed "`magic app …`; `sites app …` never ships". The App SDK commands are
      `magic sites app …` (operations `sites.app.<verb>`), and top-level `magic app` never exists.
      Cory: “"magic app" should NEVER run something for sites” and “everything should be scoped, so
      "magic sites app"”.
---

# R3: App SDK

Theme: the App SDK's developer loop under `magic sites app …`, inside the Sites namespace; there is no top-level `magic app`. Timing follows the App SDK plan's own R1/R2 (see [[DECISION-RELEASES-AND-TIMING]] (sites-app-sdk plan)).

## Scope

- The App SDK's commands as `sites.app.*` operations in the Sites product module ([[FEATURE-APP-COMMANDS]]); whether the code is a separate internal `packages/app` or part of `packages/sites` is settled when R3 is built. Local commands (`init`, `check`, `dev`) reuse the bundled Sites engine where they render.
- CI path with an `ak_` app key for `version` and `publish` (see [[DATATYPE-APP-KEY]] (sites-app-sdk plan)).

## Gate

- The App SDK reference app goes `magic sites app init` → `magic sites app dev --site <dev site>` → `magic sites app version` → `magic sites app publish` with no other tool.
