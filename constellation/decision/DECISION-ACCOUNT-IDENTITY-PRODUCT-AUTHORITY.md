---
name: 'Login: Account identity, product authority — a `cli` application kind with device flow and identity-only grants; each product mints its own key'
status: planned
connections:
  - DECISION-KEYRING-DEFAULT
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
  - COMPONENT-LOGIN
  - COMPONENT-KEYCHAIN
  - DATATYPE-ACCOUNT-CLI-GRANT
  - DATATYPE-PRODUCT-SESSION
  - API-ACCOUNT-DEVICE-AUTHORIZATION
  - API-ACCOUNT-CLI-INTROSPECT
  - API-SITES-CLI-SESSIONS
  - API-PYRAMID-CLI-SESSIONS
  - API-MARKETING-CLI-SESSIONS
  - FEATURE-ACCOUNT-CLI-KIND
  - FEATURE-DEVICE-LOGIN
  - FEATURE-PRODUCT-SESSIONS
  - FLOW-LOGIN-DEVICE
  - FLOW-LOGIN-LOOPBACK
  - FLOW-PRODUCT-SESSION-MINT
  - DIAGRAM-LOGIN
  - DOC-SECURITY
  - EXTERNAL-ACCOUNT
  - RELEASE-1-LOGIN
---

# Account identity, product authority

## Context

Facts (research §3):

- Account's handoff: `GET /auth/authorize` (exact `redirect_uri` match, `state`, S256 PKCE, `scope=basic` only, deliberately not OIDC) and form-encoded `POST /auth/token`, which swaps a 30 s single-use code for an **opaque grant** `{token_type, access_token, expires_in: 5184000, grant_id}` — 60 days absolute, 14 days idle, no refresh rotation. See [[API-AUTH-AUTHORIZE]] and [[API-AUTH-TOKEN]] (account plan).
- Client kinds are `web | ios | android | server` (`org/admin/server/internal/store/registry.go`). **No `cli` kind.** `ValidHandoffCallback`: "Loopback http callbacks are not accepted for any kind". **No device-authorization grant.**
- Introspection is `POST /internal/v1/grants/introspect` on the private `INTERNAL_URL`, needs a server credential with `grants.introspect`, and a grant is introspectable **only by the product its application belongs to**. See [[DECISION-PRODUCT-TRUST-BOUNDARY]] and [[API-INTERNAL-GRANTS-INTROSPECT]] (account plan).
- No product accepts an Account grant from a non-browser client. Sites `/v1` accepts only `pk_` (`sites/server/internal/middleware/auth.go`, `accessKeyPrefix = "pk_"`); Pyramid `pyk_`; Marketing `pmk_live_`/`pmk_test_`.
- Pyramid already mints a workspace-scoped `pyk_` from a signed-in web session for its CLI (`/auth/cli`, FLOW-CLI-BROWSER-LOGIN in the pyramid-cli plan); Sites' DB-ACCESS-KEYS (sites server plan) already computes a key that borrows a person's live authority.

## Decision

1. **Account adds a `cli` application kind**: public, PKCE only, no secret. It supports the **device-code flow** (RFC 8628) for SSH, containers and headless use, and a **loopback callback exception** (`http://127.0.0.1:{any port}/callback`, port-agnostic) for the desktop case. The exception applies to the `cli` kind only.
2. `magic` is registered as one application of kind `cli` under a new Account product `magic`.
3. **Identity-only grants.** A `cli`-kind grant carries the person only (user id, display name, email). Every product's server credential may introspect it — a bounded exception to the trust boundary for the `cli` kind alone. The answer has no entitlements and no `paid` ([[API-ACCOUNT-CLI-INTROSPECT]]).
4. **Product authority.** Each product adds `POST /v1/cli/sessions`: it introspects the Account grant, resolves the person's workspaces and roles **in that product**, and mints a product-local key bound to the person's live authority (Sites `pk_`, Pyramid `pyk_`, Marketing `pmk_`) — [[API-SITES-CLI-SESSIONS]], [[API-PYRAMID-CLI-SESSIONS]], [[API-MARKETING-CLI-SESSIONS]].
5. The CLI stores the Account grant plus one key per product in the keyring and re-mints a product key when it expires ([[DATATYPE-PRODUCT-SESSION]]). `magic logout` revokes every product key and the grant.
6. **Until Account ships the `cli` kind** (R0), `magic login --product-key` stores a pasted product key, `magic pyramid login` keeps Pyramid's existing browser mint, and `magic whoami` reports per product.

## Alternatives

- **One handoff per product.** Rejected: N browser trips per login, and it still needs the Account callback change.
- **A family-wide product whose grants every product trusts fully.** Rejected: overturns DECISION-PRODUCT-TRUST-BOUNDARY for everything, including entitlements.
- **Products accept the Account grant directly on every request.** Rejected: every API call would introspect across the private network, and each product would need grant middleware beside its key path; one mint per session is cheaper and keeps each product's existing key and scope model.
- **Stop-gap: an `ios`-kind app whose https callback shows a code to paste** (research §3). Rejected: it bends the kind's meaning; R0 uses product keys instead.

## Consequences

- **Lands in:** account (`cli` kind, device flow, loopback exception, identity-only introspection across products) — [[FEATURE-ACCOUNT-CLI-KIND]]; sites/server, pyramid/server and marketing (the mint route) — [[FEATURE-PRODUCT-SESSIONS]].
- The Account grant's 60-day absolute life means a person runs `magic login` again at least every 60 days; product keys are re-minted silently inside that window.
- Revoking a person's workspace membership in a product revokes their CLI key there, because the key borrows live authority.
