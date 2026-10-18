---
name: 'Login: magic login | logout — Account device flow or loopback, product session mint, product-key fallback'
kind: library
status: planned
framework: typescript
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - COMPONENT-KEYCHAIN
  - COMPONENT-SHELL
  - DATATYPE-ACCOUNT-CLI-GRANT
  - DATATYPE-PRODUCT-SESSION
  - API-ACCOUNT-DEVICE-AUTHORIZATION
  - API-SITES-CLI-SESSIONS
  - API-PYRAMID-CLI-SESSIONS
  - API-MARKETING-CLI-SESSIONS
  - FLOW-LOGIN-DEVICE
  - FLOW-LOGIN-LOOPBACK
  - FLOW-PRODUCT-SESSION-MINT
  - FEATURE-DEVICE-LOGIN
  - FEATURE-WHOAMI-DOCTOR
---

# Login

## Commands

| Command | Does |
|---|---|
| `magic login` | Device flow ([[FLOW-LOGIN-DEVICE]]); with a local browser and no `--device`, the loopback flow ([[FLOW-LOGIN-LOOPBACK]]). Then mints a session in every product ([[FLOW-PRODUCT-SESSION-MINT]]). |
| `magic login --device` | Forces the device flow (SSH, containers). |
| `magic login --product <p>` | Mints (or re-mints) one product's session only. |
| `magic login --product-key` | R0 path and CI escape hatch: prompts for (or reads from stdin) a product key, detects the product from its prefix, stores it. |
| `magic pyramid login` | R0 only: Pyramid's existing loopback mint via `/auth/cli` (pyramid-cli's `src/auth-commands.ts`), until R1. |
| `magic logout` | Revokes every product session server-side, revokes the Account grant, deletes every item in the store. `--product <p>` for one. |

## Rules

- A product that fails to mint (no workspaces, product down) is reported and skipped; login still succeeds for the others.
- Product keys are re-minted silently when a call returns `auth_expired` and the Account grant is live; if the grant is dead, the error says to run `magic login`.
- Nothing secret is printed; keys show masked as pyramid-cli's `maskKey` does.
