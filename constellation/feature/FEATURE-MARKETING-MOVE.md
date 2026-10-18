---
name: 'Marketing move: marketing/cli becomes packages/marketing; Marketing''s CLI session route'
status: planned
release: RELEASE-4-MARKETING-TELEMETRY-UPGRADE
change: feature
connections:
  - COMPONENT-MARKETING-PACKAGE
  - EXTERNAL-MARKETING
---

# Marketing move

**Lands in:** this repo (`packages/marketing`) · marketing (`POST /v1/cli/sessions`, the `marketing/cli` folder removed after the move)

## Scope

- Import `marketing/cli` into `packages/marketing` (history kept), on the kit: operations renamed `marketing.<noun>.<verb>`; its keychain, config file and errors replaced by the kit's.
- Marketing's session route ([[API-MARKETING-CLI-SESSIONS]]).
- Marketing's webhooks helper (`webhooks.ts`) stays only if an operation uses it.

## Acceptance

- `magic marketing contacts list`, `events track`, `reports summary` work with a key from `magic login`.
- The 10 Marketing tools appear as `marketing_*` in `magic mcp`.
