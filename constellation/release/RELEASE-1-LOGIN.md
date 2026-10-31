---
name: 'R1: Login — Account cli kind, device flow, identity-only introspection, /v1/cli/sessions in Sites and Pyramid, keyring on three OSes'
status: building
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

Status (2026-10-31, feat/r1-login at 9d2583d, CLI side only): rows 1 and 2 pass end to end against the fake Account and fake Pyramid/Sites/Marketing servers in `packages/cli/tests/login.test.ts`; they cannot pass for real until Account ships the `cli` kind, device grant, loopback exception and `magic_` grants, and Sites and Pyramid ship `/v1/cli/sessions`. Grant revocation on logout needs `POST /auth/revoke`, which Account does not have yet (logout reports `unsupported` and forgets locally). Row 3 (keyring binding on three OSes) is FEATURE-KEYRING, not built in this branch. Repo gates on that commit: build, typecheck, format:check, test (kit 142, pyramid 105 + 2 skipped, cli 53) and smoke:pack all green.

## Lead-time items (Cory)

- Approve the Account trust-boundary exception for the `cli` kind (identity only).
- Register the `magic` product and application in Account production, then put its client_id in `DEFAULT_ACCOUNT_CLIENT_ID` (packages/kit/src/config.ts; a placeholder that login refuses until then, `MAGIC_ACCOUNT_CLIENT_ID` overrides).
- Decide whether Account gets `POST /auth/revoke` (form `token`) in R1; the CLI already calls it.
