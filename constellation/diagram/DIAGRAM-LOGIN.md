---
name: 'Login: Account identity, product authority (device flow and session mint)'
status: built
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - FLOW-LOGIN-DEVICE
  - FLOW-LOGIN-LOOPBACK
  - FLOW-PRODUCT-SESSION-MINT
  - API-ACCOUNT-DEVICE-AUTHORIZATION
  - API-ACCOUNT-CLI-INTROSPECT
  - API-SITES-CLI-SESSIONS
  - API-PYRAMID-CLI-SESSIONS
  - EXTERNAL-ACCOUNT
notes:
  - kind: state
    text: >-
      2026-10-31: the flow drawn here shipped in magic-spells 0.2.0. Two labels are out of date and
      live outside any section: Sites now answers `sites_` keys per workspace (not `pk_`), and the
      introspection is Account's dedicated `/internal/v1/cli-grants/introspect`. Marketing
      (`/api/v1/cli/sessions`, `marketing_` keys) joins the parallel block in the shipped code.
---

# Login

```mermaid
sequenceDiagram
  participant CLI as magic login
  participant Browser as Person (any device)
  participant Account as Account
  participant Sites as sites-api
  participant Pyramid as Pyramid API
  CLI->>Account: POST /auth/device (client_id = Magic CLI)
  Account-->>CLI: device_code, user_code, verification_uri
  CLI-->>Browser: show code WDJB-MJHT
  Browser->>Account: /device — sign in, confirm code, approve
  loop every interval
    CLI->>Account: POST /auth/token (device_code)
  end
  Account-->>CLI: cli grant (identity only)
  par each product
    CLI->>Sites: POST /v1/cli/sessions (Bearer grant)
    Sites->>Account: introspect (internal) → user only
    Sites-->>CLI: pk_ per workspace
  and
    CLI->>Pyramid: POST /v1/cli/sessions (Bearer grant)
    Pyramid->>Account: introspect (internal) → user only
    Pyramid-->>CLI: pyramid_ per workspace
  end
  CLI->>CLI: store grant + keys in io.magicspells.cli
```

Account says who the person is; each product decides what they may do and issues its own key.
