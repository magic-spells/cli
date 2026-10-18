---
name: 'Magic Spells Account: identity for magic login'
kind: external-microservice
status: planned
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
---

# Magic Spells Account

Repo `org/admin` (Go server, Account web app, `accountctl`). Public host `account.magicspells.io`; internal host `INTERNAL_URL` for introspection.

## Today (research §3)

- PKCE handoff: `/auth/authorize` → `/auth/continue` → `/auth/token`; opaque grants, 60 d absolute, 14 d idle; client kinds `web | ios | android | server`; no loopback, no device grant.
- Introspection only by the grant's own product (DECISION-PRODUCT-TRUST-BOUNDARY, account plan).
- Go SDK only (`magicspells-sdk`, distributed through packages.magicspells.io); the CLI writes its own small TypeScript client.

## What `magic` needs

[[FEATURE-ACCOUNT-CLI-KIND]]: the `cli` kind, device flow, loopback exception, identity-only introspection, a `magic` product and application.
