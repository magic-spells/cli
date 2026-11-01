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
  - kind: state
    text: >-
      Client side built on feat/r1-login; server sides (sites, pyramid, marketing) are separate work
      and this card stays planned until they land. What the CLI sends: `POST <api><path>` with
      `Authorization: Bearer magic_…`, `content-type: application/json`, body `{"label":"magic on
      <hostname>"}` at login and `{"label":…,"workspace":"<handle>"}` on re-mint; `DELETE
      <api><path>` with `Authorization: Bearer <product key>` at logout and when a login is replaced
      (expects 204; a 401 tries the next stored key). Paths/hosts: pyramid
      https://api.pyramid.magicspells.io/v1/cli/sessions (pyramid_), sites
      https://api.sites.magicspells.io/v1/cli/sessions (sites_), marketing
      https://marketing.magicspells.io/api/v1/cli/sessions (marketing_, so marketing_live_ and
      marketing_test_ both pass). The answer may carry an optional top-level `user: {id,
      display_name, email}`, which the CLI prefers for the grant's user. An expired product key must
      be answered with 401 and an error code containing `expired` (e.g. `key_expired`) to trigger
      the re-mint.
    sha: 09b2af0
  - kind: state
    text: >-
      2026-10-31: all three server routes are merged — Sites and Pyramid `POST/DELETE
      /v1/cli/sessions` (`sites_`, `pyramid_`), Marketing `POST/DELETE /api/v1/cli/sessions`
      (`marketing_live_`/`marketing_test_`) — each introspecting through
      `/internal/v1/cli-grants/introspect`; expired keys answer 401 `key_expired`. The CLI side
      shipped in magic-spells 0.2.0. The Lands-in line's `pk_` and "marketing in R4" are superseded
      (see Scope).
  - kind: state
    text: >-
      2026-10-31, 0.2.2: hosts corrected. Pyramid https://pyramid.magicspells.io/v1/cli/sessions,
      Sites https://sites-api.magicspells.io/v1/cli/sessions; the api.pyramid / api.sites hosts in
      the earlier note were wrong (no certificate / no such host).
---

# Product sessions

**Lands in:** sites/server (`/v1/cli/sessions`, `grants.introspect` on its server credential, person-bound `pk_` minting) · pyramid/server (`/v1/cli/sessions`, `pyramid_` minting reusing the `/api-keys` path) · marketing in R4 ([[FEATURE-MARKETING-MOVE]])

## Scope

- Each product: add `grants.introspect_cli` to its Account server credential and introspect through `POST /internal/v1/cli-grants/introspect` (the generic `/internal/v1/grants/introspect` answers inactive for cli grants); the route per its API card; person lookup by Account user id; mint per workspace with a 24 h expiry and a label; `DELETE` revoking keys from the same grant; an audit line per mint; an expired key answers 401 `key_expired` on every route.
- Sites (`/v1/cli/sessions`): the minted `sites_` key is person-bound so it carries the person's live role (the access-keys model in the sites server plan).
- Pyramid (`/v1/cli/sessions`): `pyramid_` keys appear in Settings → API Keys labelled "magic on <host>" and can be revoked there.
- Marketing (`/api/v1/cli/sessions`): `marketing_live_` keys (`marketing_test_` on request); shipped in R1 alongside the others, ahead of the R4 Marketing move.

## Acceptance

- Both routes answer the same `{ sessions, workspaces }` shape for the same person.
- Removing the person from a workspace makes that workspace's CLI key fail on the next call.
- An Account grant of a non-`cli` kind is refused with 401 `grant_invalid`.
