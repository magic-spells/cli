---
name: 'R1: Login — Account cli kind, device flow, identity-only introspection, /v1/cli/sessions in Sites and Pyramid, keyring on three OSes'
status: planned
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - DECISION-KEYRING-DEFAULT
  - RELEASE-0-SCAFFOLD-AND-BASE
  - RELEASE-2-SITES
---

# R1: Login

Theme: one `magic login` for every product. Most of the work lands outside this repo.

## Scope

- **Lands in:** account — the `cli` application kind, the device-authorization grant, the loopback exception, identity-only introspection across products ([[FEATURE-ACCOUNT-CLI-KIND]]).
- `magic login` (device flow by default, loopback when a browser is local), `magic logout`, `magic whoami` across products ([[FEATURE-DEVICE-LOGIN]]).
- **Lands in:** sites/server and pyramid/server — `POST /v1/cli/sessions` ([[FEATURE-PRODUCT-SESSIONS]]). Marketing's route waits for R4.
- The cross-platform keyring with one service `io.magicspells.cli` ([[FEATURE-KEYRING]]).

## Gate

- One `magic login` on a fresh machine yields working Sites and Pyramid keys; `magic whoami` shows the person and their workspaces in both.
- `magic logout` leaves no credential in the store and the product keys are revoked server-side.
- The keyring round-trips on macOS, Linux (Secret Service) and Windows in CI.

## Lead-time items (Cory)

- Approve the Account trust-boundary exception for the `cli` kind (identity only).
- Register the `magic` product and application in Account production.
