---
name: 'R1: Login — Account cli kind, device flow, identity-only introspection, /v1/cli/sessions in Sites and Pyramid, keyring on three OSes'
status: building
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - DECISION-KEYRING-DEFAULT
  - RELEASE-0-SCAFFOLD-AND-BASE
  - RELEASE-2-SITES
notes:
  - kind: state
    text: >-
      2026-10-31: the Magic CLI application is registered in Account production (handle magic-cli,
      id 993a800d-2705-4408-bd85-686b0e182253, kind cli, product magic). DEFAULT_ACCOUNT_CLIENT_ID
      is now 'magic-cli' (packages/kit/src/config.ts) and packages/cli and packages/kit are 0.2.0 on
      release/0.2.0. Still outstanding before the first real login: the loopback callback
      http://127.0.0.1/callback on that application, Pyramid and Sites server credentials reissued
      with grants.introspect_cli, and Pyramid 0.8.0 / Sites 0.4.1 shipped to main.
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

Status (2026-10-31, feat/r1-login at 9a25cf7 after review; release/0.2.0 at cdc149b merged in; CLI side only): rows 1 and 2 pass end to end against the fake Account and fake Pyramid (`pyramid_<8>_<32>` keys), Sites and Marketing servers in `packages/cli/tests/login.test.ts`. A review cross-checked the CLI's requests against the server worktrees (Account cli-kind, Sites/Pyramid/Marketing cli-sessions) as they stood on 2026-10-31: paths, Bearer, `{label, workspace?}`, the sessions answer, `grant_invalid` / `no_workspaces` / `workspace_not_found`, 401 `key_expired`, top-level `user`, DELETE 204 and Account's `POST /auth/revoke` (form `token`, 200) all match; those server branches were still being finished, so rows 1 and 2 pass for real only once they merge and deploy. Row 3 (keyring binding on three OSes) is FEATURE-KEYRING, not built in this branch. Repo gates on 9a25cf7: build, typecheck, format:check, test (kit 145, pyramid 105 + 2 skipped resolveTask tests, cli 55; 305 passed, 2 skipped) and smoke:pack all green.

## Lead-time items (Cory)


- Approve the Account trust-boundary exception for the `cli` kind (identity only).
- Register the `magic` product and application in Account production, then put its client_id in `DEFAULT_ACCOUNT_CLIENT_ID` (packages/kit/src/config.ts; a placeholder that login refuses until then, `MAGIC_ACCOUNT_CLIENT_ID` overrides).
- `POST /auth/revoke` (form `token`, 200 empty) is in Account's cli-kind branch as of 2026-10-31; until it deploys, logout reports `unsupported` (Account's JSON 404) and forgets locally.
