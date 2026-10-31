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
notes:
  - kind: state
    text: >-
      Client side built on feat/r1-login; server sides (sites, pyramid, marketing) are separate work
      and this card stays planned until they land. What the CLI sends: `POST <api><path>` with
      `Authorization: Bearer magic_…`, `content-type: application/json`, body `{"label":"magic on
      <hostname>"}` at login and `{"label":…,"workspace":"<handle>"}` on re-mint; `DELETE
      <api><path>` with `Authorization: Bearer <product key>` at logout and when a login is replaced
      (expects 204; a 401 tries the next stored key). Paths/hosts: pyramid
      https://api.pyramid.magicspells.io/v1/cli/sessions (pyk_), sites
      https://api.sites.magicspells.io/v1/cli/sessions (sites_), marketing
      https://marketing.magicspells.io/api/v1/cli/sessions (marketing_, so marketing_live_ and
      marketing_test_ both pass). The CLI needs an expired product key to answer 401 with "expired"
      in the envelope code or message (e.g. `key_expired`) to trigger the re-mint.
    sha: 9d2583d
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
