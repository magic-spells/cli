---
name: 'Mint product sessions from the Account grant (login, re-mint on expiry)'
status: built
triggers:
  - kind: manual
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - API-ACCOUNT-CLI-INTROSPECT
  - API-SITES-CLI-SESSIONS
  - API-PYRAMID-CLI-SESSIONS
  - API-MARKETING-CLI-SESSIONS
  - DATATYPE-PRODUCT-SESSION
  - COMPONENT-LOGIN
  - COMPONENT-KEYCHAIN
  - FEATURE-PRODUCT-SESSIONS
  - DIAGRAM-LOGIN
notes:
  - kind: state
    text: >-
      Client side built on feat/r1-login (kit/src/sessions.ts, context.ts), tested against fake
      product servers. Products are data: a ProductModule with `sessions: { path }` is minted
      (pyramid /v1/cli/sessions, sites /v1/cli/sessions, marketing /api/v1/cli/sessions). Login
      mints all in parallel, then stores sequentially (one shared `account:sessions` index item
      would lose updates otherwise). Re-mint: kit runWithRemint wraps op.run in runProductCli and in
      MCP callTool (McpProduct.remint); on auth_expired with session.source==='account' it POSTs
      `{workspace:<handle>, label}`, overwrites `<product>:<handle>`, updates the grant's
      last_used_at, retries once; no grant or 401 grant_invalid → not_logged_in "Run `magic
      login`."; manual and env keys pass auth_expired through untouched. auth_expired is recognised
      the existing way (401 whose code/message contains "expired"), so product servers must answer
      an expired key with e.g. 401 `key_expired`. Re-mint is reactive only: an expired `expires_at`
      is not checked before the call.
    sha: 9d2583d
  - kind: state
    text: >-
      2026-10-31: shipped in magic-spells 0.2.0. The server half is merged in all three products
      (Sites/Pyramid `/v1/cli/sessions`, Marketing `/api/v1/cli/sessions`), each introspecting via
      Account's `/internal/v1/cli-grants/introspect` (`grants.introspect_cli`) and answering expired
      keys with 401 `key_expired`, which is what triggers the re-mint. Step 1's path is per product
      (Marketing differs).
---

# Mint product sessions

1. **cli**: for each product with a session route, in parallel, `POST <product api>/v1/cli/sessions` with `Authorization: Bearer <Account grant>` and `{ label: "magic on <hostname>" }`.
2. **product server**: introspects the grant on Account's internal host ([[API-ACCOUNT-CLI-INTROSPECT]]); `active: false` → 401 `grant_invalid`.
3. **product server**: maps the Account user id to its own person, lists their workspaces and roles **in that product**, mints one product-local key per workspace bound to the person's live authority, and answers `{ sessions, workspaces }`.
4. **cli**: stores each session as `<product>:<workspace handle>`; sets the product's default workspace when there is exactly one, otherwise leaves it unset (commands then need `--workspace`, and `magic whoami` lists them).
5. **cli**: reports per product; a product that fails (403 `no_workspaces`, network) is skipped with a reason and login still succeeds.

## Re-mint

- On a call that returns `auth_expired` for a session with `source: "account"`, the kit re-runs steps 1–4 for that product and workspace once, then retries the call once.
- If the Account grant is inactive, the error becomes `not_logged_in` with the hint "run magic login".
- `source: "manual"` keys are never re-minted.
