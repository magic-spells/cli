---
name: 'Account cli application kind: device grant, loopback exception, identity-only introspection across products'
status: planned
release: RELEASE-1-LOGIN
change: feature
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - API-ACCOUNT-DEVICE-AUTHORIZATION
  - API-ACCOUNT-CLI-INTROSPECT
  - DATATYPE-ACCOUNT-CLI-GRANT
  - EXTERNAL-ACCOUNT
---

# Account cli application kind

**Lands in:** account (org/admin: `server/internal/store/registry.go` kinds, `ValidHandoffCallback`, the token and introspect handlers, the Account web app's `/device` page, `accountctl app create --kind cli`)

## Scope

1. `cli` kind in the application registry: public, PKCE only, no client credential; `accountctl app create --kind cli`.
2. Loopback callbacks for `cli` only: `http://127.0.0.1:{any port}/callback` and `[::1]`, matched port-agnostically; every other kind keeps "Loopback http callbacks are not accepted".
3. Device authorization: `POST /auth/device`, the `/device` confirm page, the `device_code` grant on `/auth/token`, a `device_codes` table with 10-minute expiry and single use ([[API-ACCOUNT-DEVICE-AUTHORIZATION]]).
4. Grant kind `cli` on grants issued to `cli` applications (60 days absolute, 14 days idle, as every grant).
5. Introspection: a `cli` grant is introspectable by any product's server credential with `grants.introspect`; the answer is identity only; audit event per cross-product call ([[API-ACCOUNT-CLI-INTROSPECT]]).
6. A `magic` product row and the Magic CLI application registered in staging and production.
7. Account's own cards: a decision note on DECISION-PRODUCT-TRUST-BOUNDARY recording the bounded exception (written in the account plan when the work starts).

## Acceptance

- A device login completes against staging Account from a machine with no browser.
- Sites' and Pyramid's server credentials both introspect the same `cli` grant and get `user` with no `entitlements` or `paid`.
- A `web`-kind grant introspected by another product still answers as today (refused).
- A loopback redirect for a `web` or `ios` application is still refused.
