---
name: 'Mint product sessions from the Account grant (login, re-mint on expiry)'
status: planned
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
