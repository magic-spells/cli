---
name: 'Product sessions: CLI session routes in Sites, Pyramid and Marketing'
status: built
release: RELEASE-1-LOGIN
change: feature
connections:
  - API-SITES-CLI-SESSIONS
  - API-PYRAMID-CLI-SESSIONS
  - API-MARKETING-CLI-SESSIONS
  - FLOW-PRODUCT-SESSION-MINT
  - DATATYPE-PRODUCT-SESSION
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - EXTERNAL-SITES
  - EXTERNAL-PYRAMID
notes:
  - kind: verified
    text: >-
      2026-11-01: first real end-to-end login on magic-spells 0.3.0 against production. Account
      grant minted (60-day absolute, 14-day idle); Pyramid minted keys for both of Cory's workspaces
      (no default, two workspaces), Sites minted one key with that workspace as default, both stored
      in the keychain, keys expire 24h out; Marketing skipped (not deployed). whoami shows the user
      from the products' answers.
---

# Product sessions

**Lands in:** sites/server (`https://sites-api.magicspells.io/v1/cli/sessions`, person-bound `sites_` keys) · pyramid/server (`https://pyramid.magicspells.io/v1/cli/sessions`, `pyramid_` keys reusing the `/api-keys` path) · marketing (`https://marketing.magicspells.io/api/v1/cli/sessions`). The CLI side shipped in magic-spells 0.2.0; the request and response contract is [[DATATYPE-PRODUCT-SESSION]].

## Scope

- Each product: add `grants.introspect_cli` to its Account server credential and introspect through `POST /internal/v1/cli-grants/introspect` (the generic `/internal/v1/grants/introspect` answers inactive for cli grants); the route per its API card; person lookup by Account user id; mint per workspace with a 24 h expiry and a label; `DELETE` revoking keys from the same grant; an audit line per mint; an expired key answers 401 `key_expired` on every route.
- Sites (`/v1/cli/sessions`): the minted `sites_` key is person-bound so it carries the person's live role (the access-keys model in the sites server plan).
- Pyramid (`/v1/cli/sessions`): `pyramid_` keys appear in Settings → API Keys labelled "magic on <host>" and can be revoked there.
- Marketing (`/api/v1/cli/sessions`): `marketing_live_` keys (`marketing_test_` on request); shipped in R1 alongside the others, ahead of the R4 Marketing move.

## Acceptance

- Both routes answer the same `{ sessions, workspaces }` shape for the same person.
- Removing the person from a workspace makes that workspace's CLI key fail on the next call.
- An Account grant of a non-`cli` kind is refused with 401 `grant_invalid`.
