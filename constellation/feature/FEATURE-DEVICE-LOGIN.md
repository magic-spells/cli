---
name: 'magic login and logout through Account: device flow, loopback, product session mint, whoami across products'
status: built
release: RELEASE-1-LOGIN
change: feature
connections:
  - COMPONENT-LOGIN
  - FLOW-LOGIN-DEVICE
  - FLOW-LOGIN-LOOPBACK
  - FLOW-PRODUCT-SESSION-MINT
  - API-ACCOUNT-DEVICE-AUTHORIZATION
  - DATATYPE-ACCOUNT-CLI-GRANT
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
notes:
  - kind: state
    text: >-
      CLI side built on feat/r1-login (9246384..9d2583d), not merged, not yet run against a real
      Account or product (none of the server routes exist yet). Kit: account.ts (PKCE S256 with a
      32-byte verifier, authorizeUrl, exchangeCode, startDevice, pollDevice, waitForDevice, revoke),
      loopback.ts, sessions.ts, context.ts runWithRemint/remintFor, new error code auth_cancelled
      (exit 3), config accountClientId. CLI: commands/login.ts (login, --device, --product, --yes,
      --product-key, logout), browser.ts, whoami.ts and doctor.ts rewritten, mcp.ts passes remint.
      Products: pyramid declares sessions; new packages/sites and packages/marketing are
      sign-in-only modules. `magic pyramid login` removed. Tests:
      kit/tests/{account,loopback,sessions}.test.ts and cli/tests/login.test.ts against
      kit/tests/fakes.ts (fake Account with PKCE check and device state machine; fake product
      servers with mint/DELETE/expire-once). Acceptance rows 1-3 need the real Account + Sites +
      Pyramid routes.
    sha: 9d2583d
  - kind: decision
    text: >-
      Choices made while building (brief left them open): (1) The session index lives in the store
      as `account:sessions`, not in account:grant (keeps the grant identity-only) and not in
      config.json (secrets and their index cannot drift apart). (2) Resolution order: MAGIC_<P>_KEY
      → account session for --workspace / config defaultWorkspace / the single minted workspace →
      `<product>:manual` → usage (several workspaces, none chosen, candidates listed) →
      not_logged_in. Rejected: manual before account (a stale pasted key would shadow a fresh
      login). (3) `--workspace` on `magic <product> …` now always picks the session; it fills a
      `workspace` input only when the operation has one (R0 made it a usage error elsewhere). (4)
      Account failures: access_denied/Ctrl-C → auth_cancelled; expired device code and loopback
      timeout → auth_expired; invalid_grant/invalid_client/other 4xx → auth_invalid; 429 →
      rate_limited; 5xx → product_unavailable; transport → network; all with product `account`. (5)
      Logout revokes the grant best-effort: 404/405 from /auth/revoke is reported as `account:
      "unsupported"` (Account has no revoke endpoint today) and local items are deleted regardless.
      (6) doctor: a product without a key is a warning when anything else is signed in (a person
      with no Marketing workspace is not broken); Account unreachable fails only when a grant is
      stored. (7) Sign-in-only products (no operations, no MCP register) are left out of `magic
      mcp`. (8) `WAYLAND_DISPLAY` counts as a display on Linux alongside `DISPLAY`.
    sha: 9d2583d
  - kind: state
    text: >-
      2026-10-31: shipped in magic-spells 0.2.0 (tagged, on npm; 0.2.1 is the zod 4 bump). The
      earlier "not merged / server routes do not exist" note is history: feat/r1-login merged (PR
      #5), the compiled-in client id is `magic-cli`, and Account (device flow, revoke, cli-grants
      introspect) plus the Sites, Pyramid and Marketing session routes are all merged. `POST
      /auth/revoke` now exists, so the "unsupported" logout path is only a fallback.
---

# Device login

## Scope

- The CLI side of [[FLOW-LOGIN-DEVICE]], [[FLOW-LOGIN-LOOPBACK]] and [[FLOW-PRODUCT-SESSION-MINT]], per [[COMPONENT-LOGIN]].
- A small TypeScript Account client (form-encoded `/auth/device`, `/auth/token`; no SDK — the Go `magicspells-sdk` is not usable here).
- Silent re-mint on `auth_expired`; `magic logout` revoking product keys (`DELETE /v1/cli/sessions`) then deleting store items.
- `magic whoami` with the Account identity and per-product workspaces.
- Removal of `magic pyramid login`.

## Acceptance

- The R1 gate: one `magic login` yields working Sites and Pyramid keys.
- `magic login --device` over SSH works with the code typed on a phone.
- After `magic logout`, `magic whoami` shows no identity and the old `sites_` and `pyramid_` keys return 401.
