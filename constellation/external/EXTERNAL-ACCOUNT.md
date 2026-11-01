---
name: 'Magic Spells Account: identity for magic login'
kind: external-microservice
status: built
vendor: Magic Spells
purpose: 'Issues the identity-only cli grant (device flow or loopback) and introspects it for every product'
docs_url: ../org/admin/constellation
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - API-ACCOUNT-DEVICE-AUTHORIZATION
  - API-ACCOUNT-CLI-INTROSPECT
  - FEATURE-ACCOUNT-CLI-KIND
  - DIAGRAM-ARCHITECTURE
  - DIAGRAM-LOGIN
notes:
  - kind: state
    text: >-
      2026-10-31: everything magic needs from Account is merged and in use since magic-spells 0.2.0:
      cli kind, loopback exception, device flow with lookup/confirm, `POST /auth/revoke`,
      `/internal/v1/cli-grants/introspect` (SDK 0.8.0, `grants.introspect_cli`), and the registered
      application `magic-cli`.
---

# Magic Spells Account

Repo `org/admin` (Go server, Account web app, `accountctl`). Public host `account.magicspells.io`; internal host `INTERNAL_URL` for introspection.

## Today (research §3)

- PKCE handoff: `/auth/authorize` → `/auth/continue` → `/auth/token`; opaque grants, 60 d absolute, 14 d idle; client kinds now include `cli`, which alone may use a loopback callback.
- Device flow (as of 2026-10-31): `POST /auth/device`, the `/device` page, `GET /auth/device/lookup`, `POST /auth/device/confirm`, the device_code grant on `POST /auth/token`, and `POST /auth/revoke`.
- Introspection: ordinary grants only by their own product (DECISION-PRODUCT-TRUST-BOUNDARY, account plan); cli grants by any product through `POST /internal/v1/cli-grants/introspect` (SDK 0.8.0 `IntrospectCLIGrant`, credential operation `grants.introspect_cli`), identity only. The generic `/internal/v1/grants/introspect` answers inactive for cli grants.
- Go SDK only (`magicspells-sdk`, distributed through packages.magicspells.io); the CLI writes its own small TypeScript client.

## What `magic` needs

[[FEATURE-ACCOUNT-CLI-KIND]]: the `cli` kind, device flow, loopback exception, identity-only introspection, a `magic` product and the registered application `magic-cli` (the compiled-in client id). All shipped by 2026-10-31.
