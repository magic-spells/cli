---
name: 'Upgrade: cached update notice and magic upgrade'
status: planned
release: RELEASE-4-MARKETING-TELEMETRY-UPGRADE
change: feature
connections:
  - COMPONENT-UPGRADE
  - FLOW-UPGRADE
---

# Upgrade

## Scope

- [[COMPONENT-UPGRADE]] and [[FLOW-UPGRADE]]: cache, detached refresh, notice gating, install-method detection, `magic upgrade`.

## Acceptance

- An older global install prints one notice line at most once per command and never under `--json` or `magic mcp`.
- `magic upgrade` under global npm moves to the latest version and the engine package follows.
- Under `npx`, `magic upgrade` prints the `@latest` form and changes nothing.
