---
name: >-
  Account identity-only introspection of cli grants: POST /internal/v1/cli-grants/introspect,
  callable by every product
status: built
path: /internal/v1/cli-grants/introspect
methods:
  POST: {}
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - DATATYPE-ACCOUNT-CLI-GRANT
  - FEATURE-ACCOUNT-CLI-KIND
  - FLOW-PRODUCT-SESSION-MINT
  - API-SITES-CLI-SESSIONS
  - API-PYRAMID-CLI-SESSIONS
  - API-MARKETING-CLI-SESSIONS
  - EXTERNAL-ACCOUNT
notes:
  - kind: state
    text: >-
      2026-10-31: shipped in Account (used by magic-spells 0.2.0). As built it is NOT the generic
      route with a cli exception: it is a dedicated route, `POST /internal/v1/cli-grants/introspect`
      (SDK 0.8.0 `IntrospectCLIGrant`), on the internal host, and the caller's server credential
      needs the operation `grants.introspect_cli` (not `grants.introspect`). The generic
      `/internal/v1/grants/introspect` answers `{active:false}` for cli grants. Read the body's
      "existing route ... with one change" and `grants.introspect` wording with that correction; the
      identity-only answer shape is unchanged.
---

# Account CLI grant introspection

**Lands in:** account (introspect handler and its product check; see [[API-INTERNAL-GRANTS-INTROSPECT]] and [[DECISION-PRODUCT-TRUST-BOUNDARY]] (account plan))

The existing route, on the private `INTERNAL_URL` host only, with one change: a grant whose application is of kind `cli` may be introspected by **any** product's server credential holding `grants.introspect`, and the answer for such a grant is identity only. Grants of every other kind keep the one-product rule.

- Auth: the calling product's server credential (unchanged).
- Request: `{ "token": "<access_token>" }` (unchanged).
- 200 for a live `cli` grant:

```json
{
  "active": true,
  "grant_id": "grt_…",
  "application": { "id": "app_…", "kind": "cli", "product": "magic" },
  "user": { "id": "usr_…", "display_name": "…", "email": "…" },
  "session": { "id": "grt_…", "expires_at": "…", "idle_expires_at": "…" }
}
```

- No `entitlements`, no `paid`, no product fields — for any caller.
- 200 `{ "active": false }` for unknown, expired, idle-expired or revoked grants (unchanged).
- Each call counts as use for the 14-day idle clock.
- Audit: each cross-product introspection writes an audit event naming the calling product.
