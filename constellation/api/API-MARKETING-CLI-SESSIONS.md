---
name: 'Marketing CLI sessions: POST /api/v1/cli/sessions — Account cli grant in, marketing_ keys out'
status: built
path: /api/v1/cli/sessions
methods:
  POST:
    response_schema: DATATYPE-PRODUCT-SESSION
  DELETE: {}
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - API-ACCOUNT-CLI-INTROSPECT
  - FEATURE-MARKETING-MOVE
  - FEATURE-PRODUCT-SESSIONS
  - FLOW-PRODUCT-SESSION-MINT
  - COMPONENT-MARKETING-PACKAGE
  - EXTERNAL-MARKETING
notes:
  - kind: state
    text: >-
      2026-10-31: merged in Marketing and used by magic-spells 0.2.0 (packages/marketing declares
      it). As built: the path is `/api/v1/cli/sessions` (POST and DELETE); keys are
      `marketing_live_…` (`marketing_test_…` on request), not `pmk_`; introspection goes through
      Account's `/internal/v1/cli-grants/introspect` with `grants.introspect_cli`; an expired key
      answers 401 `key_expired`; labels over 80 characters are refused. It shipped in R1, not R4 —
      the body's `pmk_` and "Ships in R4" lines are superseded.
---

# Marketing CLI sessions

**Lands in:** marketing (its API server; the key model behind `GET /api/v1/key`)

Same contract as the Sites and Pyramid routes. Marketing's existing API lives under `/api/v1`; the route may land as `/api/v1/cli/sessions` to match, and the CLI reads the path from the product module, so either works.

- `POST`: Bearer Account `cli` grant → introspect → Marketing person → workspaces → one `pmk_live_` key per workspace (never `pmk_test_` unless `{ "mode": "test" }` is sent), expiry 24 h. 200 `{ sessions, workspaces }`.
- `DELETE`: Bearer the `pmk_` key; revokes keys from the same grant. 204.
- Errors: 401 `grant_invalid`, 403 `no_workspaces`, 404 `workspace_not_found`.
- Ships in R4 with the Marketing move; until then Marketing works with a pasted key.
