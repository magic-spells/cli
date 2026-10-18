---
name: 'R3: App SDK — magic app init | dev | check | version | publish | install | logs | events replay | import'
status: planned
connections:
  - RELEASE-2-SITES
  - RELEASE-4-MARKETING-TELEMETRY-UPGRADE
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
---

# R3: App SDK

Theme: the App SDK's developer loop under `magic app …`; `sites app …` never ships. Timing follows the App SDK plan's own R1/R2 (see [[DECISION-RELEASES-AND-TIMING]] (sites-app-sdk plan)).

## Scope

- `packages/app` with the App SDK's commands as operations ([[FEATURE-APP-COMMANDS]]); local commands (`init`, `check`, `dev`) reuse the bundled Sites engine where they render.
- CI path with an `ak_` app key for `version` and `publish` (see [[DATATYPE-APP-KEY]] (sites-app-sdk plan)).

## Gate

- The App SDK reference app goes `magic app init` → `magic app dev --site <dev site>` → `magic app version` → `magic app publish` with no other tool.
