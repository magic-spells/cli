---
name: 'R4: Marketing, telemetry and upgrade — packages/marketing moved in, consent-gated telemetry, magic upgrade, docs site'
status: planned
connections:
  - RELEASE-3-APP-SDK
  - DECISION-PUBLIC-NPM-RELEASE-ON-TAG
notes:
  - kind: state
    text: >-
      2026-10-31: the update notice and the CLI's self-update shipped early on release/0.3.0 as
      `magic update` (no alias; FEATURE-UPGRADE, COMPONENT-UPGRADE). Read `magic upgrade` in this
      card as `magic update`.
---

# R4: Marketing, telemetry and upgrade

Theme: finish the family and the CLI's own housekeeping. Later (not scheduled): Reviews and Wishlist namespaces as those products ship, and a hosted MCP.

## Scope

- Marketing's CLI moved in as `packages/marketing`; **Lands in:** marketing — `POST /v1/cli/sessions` ([[FEATURE-MARKETING-MOVE]]).
- Telemetry with an explicit consent prompt, off until answered ([[FEATURE-TELEMETRY]]).
- The cached update notice and `magic upgrade` ([[FEATURE-UPGRADE]]).
- Public docs site (location open in [[DOC-OPEN-DECISIONS]]).

## Gate

- `magic marketing contacts list` works with the key from `magic login`.
- A fresh install asks about telemetry once, sends nothing before the answer, and `magic telemetry off` stops it.
- An outdated install prints one notice line on stderr and `magic upgrade` updates it with the person's own package manager.
