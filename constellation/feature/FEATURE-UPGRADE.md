---
name: 'Upgrade: cached update notice and magic update'
status: planned
release: RELEASE-4-MARKETING-TELEMETRY-UPGRADE
change: feature
connections:
  - COMPONENT-UPGRADE
  - FLOW-UPGRADE
notes:
  - kind: deviation
    text: >-
      2026-10-31 (feat/upgrade, release/0.3.0): the command is `magic update` only, no alias; read
      every `magic upgrade` in this card as `magic update`. Built as COMPONENT-UPGRADE describes:
      npm global installs only, npx prints that it already fetches the latest, anything else prints
      the install command. The engine-follows criterion is untestable until the Sites engine ships
      (R2).
---

# Upgrade

## Scope


- [[COMPONENT-UPGRADE]] and [[FLOW-UPGRADE]]: cache, background refresh, notice gating, install-method detection, `magic update`.

## Acceptance


- An older global install prints one notice line at most once per command and never under `--json` or `magic mcp`.
- `magic update` under global npm moves to the latest version and the engine package follows.
- Under `npx`, `magic update` says npx already fetches the latest version and changes nothing.
