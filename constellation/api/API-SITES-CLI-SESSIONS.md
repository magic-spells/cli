---
name: >-
  Sites CLI sessions: POST /v1/cli/sessions — Account cli grant in, sites_ keys bound to the person
  out
status: built
path: /v1/cli/sessions
methods:
  POST:
    response_schema: DATATYPE-PRODUCT-SESSION
  DELETE: {}
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - API-ACCOUNT-CLI-INTROSPECT
  - FEATURE-PRODUCT-SESSIONS
  - FLOW-PRODUCT-SESSION-MINT
  - COMPONENT-LOGIN
  - COMPONENT-SITES-ADAPTER
  - EXTERNAL-SITES
notes:
  - kind: state
    text: >-
      2026-10-31: merged in Sites and used by magic-spells 0.2.0. Sites' key prefix is now `sites_`
      (was `pk_`; the Lands-in line's `pk_` middleware is the same key middleware under the new
      prefix). Introspection through Account's `/internal/v1/cli-grants/introspect` with
      `grants.introspect_cli`; expired keys answer 401 `key_expired` on every route.
---

# Sites CLI sessions

**Lands in:** sites/server (a route on `sites-api` beside the `pk_` middleware in `internal/middleware/auth.go`; key minting in the access-keys store — see [[DB-ACCESS-KEYS]] (sites server plan))

## `POST /v1/cli/sessions`

- Auth: `Authorization: Bearer <Account cli grant>`. The route is the only `/v1` route that accepts an Account grant; it is CSRF-exempt like `sites_` key requests. Sites introspects with its own server credential (`SITES_ACCOUNT_*`) through Account's `POST /internal/v1/cli-grants/introspect`, needing the credential operation `grants.introspect_cli` ([[API-ACCOUNT-CLI-INTROSPECT]]).
- Body: `{ "workspace"?: "<handle>", "label"?: "magic on <hostname>" }`.
- Steps: introspect → find the Sites person by Account user id (as the web session path does, see [[EXTERNAL-ACCOUNT-IDENTITY]] (sites plan)) → list their workspace memberships → mint one `sites_` key per workspace (or the one asked for) of kind "person-bound", label as given, expiry 24 h.
- 200: [[DATATYPE-PRODUCT-SESSION]] list wrapper `{ sessions, workspaces }`.
- Errors (Sites' `{error:{code,message}}` envelope): 401 `grant_invalid` (inactive grant), 403 `no_workspaces` (person exists in Account but has no Sites membership), 404 `workspace_not_found`, 429. An expired minted key answers 401 `key_expired` on every route.

## `DELETE /v1/cli/sessions`

- Auth: the session's own `sites_` key. Revokes every key minted by the same grant on this person. 204.
