---
name: >-
  Pyramid CLI sessions: POST /v1/cli/sessions — Account cli grant in, workspace-scoped pyramid_ keys
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
  - COMPONENT-PYRAMID-PACKAGE
  - EXTERNAL-PYRAMID
notes:
  - kind: state
    text: >-
      2026-10-31: merged in Pyramid and used by magic-spells 0.2.0. Mints `pyramid_<8>_<32>` keys;
      introspects through Account's `/internal/v1/cli-grants/introspect` with
      `grants.introspect_cli`; expired keys answer 401 `key_expired` on every route.
  - kind: state
    text: >-
      2026-10-31, 0.2.2: the route is served on `https://pyramid.magicspells.io` (Pyramid's API
      lives on the web host); the `api.pyramid.magicspells.io` host named above has no certificate.
---

# Pyramid CLI sessions

**Lands in:** pyramid/server (on the API host `api.pyramid.magicspells.io`)

Pyramid already mints a workspace-scoped `pyramid_` key for its CLI from a signed-in web session (`/auth/cli` page reusing `POST /api-keys`, delivering the key in a POST body to the CLI's loopback listener; FLOW-CLI-BROWSER-LOGIN in the pyramid-cli plan). This route does the same from an Account `cli` grant, with no browser.

## `POST /v1/cli/sessions`

- Auth: `Authorization: Bearer <Account cli grant>`; Pyramid introspects with its server credential ([[API-ACCOUNT-CLI-INTROSPECT]]).
- Body: `{ "workspace"?: "<handle>", "label"?: "magic on <hostname>" }`.
- Steps: introspect → Pyramid user by Account user id → workspace memberships → mint a `pyramid_` key per workspace, labelled, expiry 24 h, revocable from Settings → API Keys like any key.
- 200: `{ sessions: ProductSession[], workspaces }` ([[DATATYPE-PRODUCT-SESSION]]).
- Errors (Pyramid's `{error:{code,message,details}}` envelope): 401 `grant_invalid`, 403 `no_workspaces`, 404 `workspace_not_found`.

## `DELETE /v1/cli/sessions`

- Auth: the `pyramid_` key. Revokes every key minted from the same grant. 204.
