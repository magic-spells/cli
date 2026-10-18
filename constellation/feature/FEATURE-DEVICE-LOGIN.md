---
name: 'magic login and logout through Account: device flow, loopback, product session mint, whoami across products'
status: planned
release: RELEASE-1-LOGIN
change: feature
connections:
  - COMPONENT-LOGIN
  - FLOW-LOGIN-DEVICE
  - FLOW-LOGIN-LOOPBACK
  - FLOW-PRODUCT-SESSION-MINT
  - API-ACCOUNT-DEVICE-AUTHORIZATION
  - DATATYPE-ACCOUNT-CLI-GRANT
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
---

# Device login

## Scope

- The CLI side of [[FLOW-LOGIN-DEVICE]], [[FLOW-LOGIN-LOOPBACK]] and [[FLOW-PRODUCT-SESSION-MINT]], per [[COMPONENT-LOGIN]].
- A small TypeScript Account client (form-encoded `/auth/device`, `/auth/token`; no SDK — the Go `magicspells-sdk` is not usable here).
- Silent re-mint on `auth_expired`; `magic logout` revoking product keys (`DELETE /v1/cli/sessions`) then deleting store items.
- `magic whoami` with the Account identity and per-product workspaces.
- Removal of `magic pyramid login`.

## Acceptance

- The R1 gate: one `magic login` yields working Sites and Pyramid keys.
- `magic login --device` over SSH works with the code typed on a phone.
- After `magic logout`, `magic whoami` shows no identity and the old `pk_` and `pyk_` keys return 401.
