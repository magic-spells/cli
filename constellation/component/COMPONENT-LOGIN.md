---
name: 'Login: magic login | logout — Account device flow or loopback, product session mint, product-key fallback'
kind: library
status: building
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
notes:
  - kind: gotcha
    text: >-
      (1) `magic mcp` has no per-call workspace: with several workspaces in a product and no
      `defaultWorkspace.<product>` in config.json, that product's tools answer `usage` (candidates
      listed). (2) A workspace whose handle is literally `manual` would collide with the
      `<product>:manual` pasted-key item; not guarded. (3) Ctrl-C during the mint phase (after the
      grant is stored) aborts the mint fetches, which then report as network failures per product;
      the grant stays stored. (4) The loopback timeout and an expired device code are auth_expired,
      the same code products use for an expired key; only runWithRemint (product operations) acts on
      it, so login is not affected.
    sha: 9d2583d
  - kind: state
    text: >-
      Review fixes (2026-10-31): the loopback compares `state` in constant time and stops its
      2-minute timer once a code arrives (it could end the login mid-exchange and orphan the grant
      Account was issuing; the exchange keeps its own 30 s limit). Session labels `magic on <host>`
      are capped at 80 characters (Marketing refuses longer labels). `magic doctor` re-mints an
      expired account key before the product checks, as commands do. On Windows the browser opens
      through `rundll32 url.dll,FileProtocolHandler`: `cmd /c start` split the authorize URL at
      every `&`.
    sha: 9a25cf7
---

# Login

Code: `packages/cli/src/commands/login.ts` (login, logout), `packages/cli/src/browser.ts` (browser detection, open, confirm); the product-free parts live in the kit: `account.ts` (Account client), `loopback.ts` (callback server), `sessions.ts` (grant, index, mint, revoke, re-mint).

## Commands

| Command | Does |
|---|---|
| `magic login` | Loopback flow ([[FLOW-LOGIN-LOOPBACK]]) when a browser is local (no `SSH_CONNECTION`; on Linux `DISPLAY` or `WAYLAND_DISPLAY`), else the device flow ([[FLOW-LOGIN-DEVICE]]). Then mints a session in every product that declares a sessions route, in parallel ([[FLOW-PRODUCT-SESSION-MINT]]). |
| `magic login --device` | Forces the device flow (SSH, containers). |
| `magic login --product <p>` | Mints (or re-mints) one product's sessions from the stored grant; signs in first only when there is no live grant. |
| `magic login --yes` | Replaces an existing sign-in without asking. |
| `magic login --product-key [<p>]` | CI escape hatch: prompts for (or reads from stdin) a product key, detects the product from its prefix, stores it as `<product>:manual`. |
| `magic logout` | DELETEs each product's sessions with one of its own keys, revokes the Account grant (`POST /auth/revoke`), deletes every item in the store. `--product <p>` for one product (the grant stays). |

`magic pyramid login` (R0's browser handoff to Pyramid's `/auth/cli`) is removed.

## Rules

- A product that fails to mint (no workspaces, product down, malformed answer) is reported and skipped; login still succeeds for the others and exits 0.
- A second login while signed in asks to replace (`--yes` skips; without a terminal `--yes` is required). The old grant and the old product keys are revoked only after the new grant is stored and minted; old items for products not re-minted are deleted.
- Ctrl-C during sign-in stores nothing (auth_cancelled, exit 3).
- Product keys are re-minted silently when a call returns `auth_expired` for an account session and the grant is live; a dead grant becomes not_logged_in "Run `magic login`".
- Nothing secret is printed; keys show masked (`maskKey`). The device user code is printed even with `--quiet`.
- The Account client id comes from `MAGIC_ACCOUNT_CLIENT_ID` or `DEFAULT_ACCOUNT_CLIENT_ID` in kit config (a placeholder until the production application is registered; login refuses it with a usage error before opening a browser).
