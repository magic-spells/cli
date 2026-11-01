---
name: 'Account cli application kind: device grant, loopback exception, identity-only introspection across products'
status: built
release: RELEASE-1-LOGIN
change: feature
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - API-ACCOUNT-DEVICE-AUTHORIZATION
  - API-ACCOUNT-CLI-INTROSPECT
  - DATATYPE-ACCOUNT-CLI-GRANT
  - EXTERNAL-ACCOUNT
notes:
  - kind: state
    text: >-
      2026-10-31: shipped in Account. cli kind, loopback exception, device flow (with
      lookup/confirm), `POST /auth/revoke`, the dedicated `/internal/v1/cli-grants/introspect` route
      (SDK 0.8.0, `grants.introspect_cli`), and the application `magic-cli` registered in
      production. magic-spells 0.2.0 is the first CLI release that signs in through it.
---

# Account cli application kind

**Lands in:** account (org/admin: `server/internal/store/registry.go` kinds, `ValidHandoffCallback`, the token and introspect handlers, the Account web app's `/device` page, `accountctl app create --kind cli`)

## Scope

1. `cli` kind in the application registry: public, PKCE only, no client credential; `accountctl app create --kind cli`.
2. Loopback callbacks for `cli` only: `http://127.0.0.1:{any port}/callback` and `[::1]`, matched port-agnostically; every other kind keeps "Loopback http callbacks are not accepted".
3. Device authorization: `POST /auth/device`, the `/device` confirm page (backed by `GET /auth/device/lookup` and `POST /auth/device/confirm`), the `device_code` grant on `/auth/token`, a `device_codes` table with 10-minute expiry and single use ([[API-ACCOUNT-DEVICE-AUTHORIZATION]]); `POST /auth/revoke` for logout.
4. Grant kind `cli` on grants issued to `cli` applications (60 days absolute, 14 days idle, as every grant).
5. Introspection: a dedicated route `POST /internal/v1/cli-grants/introspect` (SDK 0.8.0 `IntrospectCLIGrant`) callable by any product's server credential holding the operation `grants.introspect_cli`; the answer is identity only; audit event per cross-product call. The generic `/internal/v1/grants/introspect` answers inactive for cli grants ([[API-ACCOUNT-CLI-INTROSPECT]]).
6. A `magic` product row and the Magic CLI application (handle `magic-cli`) registered in staging and production.
7. Account's own cards: a decision note on DECISION-PRODUCT-TRUST-BOUNDARY recording the bounded exception (written in the account plan when the work starts).

## Acceptance

- A device login completes against staging Account from a machine with no browser.
- Sites' and Pyramid's server credentials both introspect the same `cli` grant and get `user` with no `entitlements` or `paid`.
- A `web`-kind grant introspected by another product still answers as today (refused).
- A loopback redirect for a `web` or `ios` application is still refused.
