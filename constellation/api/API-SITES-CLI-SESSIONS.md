---
name: 'Sites CLI sessions: POST /v1/cli/sessions — Account cli grant in, pk_ keys bound to the person out'
status: planned
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
---

# Sites CLI sessions

**Lands in:** sites/server (a route on `sites-api` beside the `pk_` middleware in `internal/middleware/auth.go`; key minting in the access-keys store — see [[DB-ACCESS-KEYS]] (sites server plan))

## `POST /v1/cli/sessions`

- Auth: `Authorization: Bearer <Account cli grant>`. The route is the only `/v1` route that accepts an Account grant; it is CSRF-exempt like `pk_` requests. Sites introspects with its own server credential (`SITES_ACCOUNT_*`), needing `grants.introspect` ([[API-ACCOUNT-CLI-INTROSPECT]]).
- Body: `{ "workspace"?: "<handle>", "label"?: "magic on <hostname>" }`.
- Steps: introspect → find the Sites person by Account user id (as the web session path does, see [[EXTERNAL-ACCOUNT-IDENTITY]] (sites plan)) → list their workspace memberships → mint one `pk_` per workspace (or the one asked for) of kind "person-bound", label as given, expiry 24 h.
- 200: [[DATATYPE-PRODUCT-SESSION]] list wrapper `{ sessions, workspaces }`.
- Errors (Sites' `{error:{code,message}}` envelope): 401 `grant_invalid` (inactive grant), 403 `no_workspaces` (person exists in Account but has no Sites membership), 404 `workspace_not_found`, 429.

## `DELETE /v1/cli/sessions`

- Auth: the session's own `pk_` key. Revokes every key minted by the same grant on this person. 204.
