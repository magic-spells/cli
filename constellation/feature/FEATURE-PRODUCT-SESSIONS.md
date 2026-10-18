---
name: 'Product sessions: POST /v1/cli/sessions in Sites and Pyramid (Marketing in R4)'
status: planned
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
---

# Product sessions

**Lands in:** sites/server (`/v1/cli/sessions`, `grants.introspect` on its server credential, person-bound `pk_` minting) · pyramid/server (`/v1/cli/sessions`, `pyk_` minting reusing the `/api-keys` path) · marketing in R4 ([[FEATURE-MARKETING-MOVE]])

## Scope

- Each product: add `grants.introspect` to its Account server credential; the route per its API card; person lookup by Account user id; mint per workspace with a 24 h expiry and a label; `DELETE` revoking keys from the same grant; an audit line per mint.
- Sites: the minted `pk_` is person-bound so it carries the person's live role (the access-keys model in the sites server plan).
- Pyramid: keys appear in Settings → API Keys labelled "magic on <host>" and can be revoked there.

## Acceptance

- Both routes answer the same `{ sessions, workspaces }` shape for the same person.
- Removing the person from a workspace makes that workspace's CLI key fail on the next call.
- An Account grant of a non-`cli` kind is refused with 401 `grant_invalid`.
