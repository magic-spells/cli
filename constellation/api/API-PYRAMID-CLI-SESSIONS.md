---
name: 'Pyramid CLI sessions: POST /v1/cli/sessions — Account cli grant in, workspace-scoped pyk_ keys out'
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
  - COMPONENT-PYRAMID-PACKAGE
  - EXTERNAL-PYRAMID
---

# Pyramid CLI sessions

**Lands in:** pyramid/server (on the API host `api.pyramid.magicspells.io`)

Pyramid already mints a workspace-scoped `pyk_` for its CLI from a signed-in web session (`/auth/cli` page reusing `POST /api-keys`; FLOW-CLI-BROWSER-LOGIN in the pyramid-cli plan). This route does the same from an Account `cli` grant, with no browser.

## `POST /v1/cli/sessions`

- Auth: `Authorization: Bearer <Account cli grant>`; Pyramid introspects with its server credential ([[API-ACCOUNT-CLI-INTROSPECT]]).
- Body: `{ "workspace"?: "<handle>", "label"?: "magic on <hostname>" }`.
- Steps: introspect → Pyramid user by Account user id → workspace memberships → mint a `pyk_` per workspace, labelled, expiry 24 h, revocable from Settings → API Keys like any key.
- 200: `{ sessions: ProductSession[], workspaces }` ([[DATATYPE-PRODUCT-SESSION]]).
- Errors (Pyramid's `{error:{code,message,details}}` envelope): 401 `grant_invalid`, 403 `no_workspaces`, 404 `workspace_not_found`.

## `DELETE /v1/cli/sessions`

- Auth: the `pyk_` key. Revokes every key minted from the same grant. 204.
