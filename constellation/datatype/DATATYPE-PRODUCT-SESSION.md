---
name: 'Product session: a product-local key minted from the Account grant, scoped to one workspace'
status: built
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - API-SITES-CLI-SESSIONS
  - API-PYRAMID-CLI-SESSIONS
  - API-MARKETING-CLI-SESSIONS
  - FLOW-PRODUCT-SESSION-MINT
  - COMPONENT-LOGIN
  - COMPONENT-KEYCHAIN
  - DATATYPE-KEYCHAIN-ENTRY
notes:
  - kind: state
    text: >-
      2026-10-31: shipped in magic-spells 0.2.0; matches the merged Sites, Pyramid and Marketing
      routes (`sites_`, `pyramid_`, `marketing_live_`/`marketing_test_` keys; 401 `key_expired` for
      expired keys).
---

The response body of every product's `POST /v1/cli/sessions` (Marketing: `/api/v1/cli/sessions`), checked and stored per workspace as `<product>:<handle>` with `source: "account"`.

```ts
interface ProductSession {
  product: 'pyramid' | 'sites' | 'marketing';
  key: string;                 // pyramid_… | sites_… | marketing_live_… (marketing_test_… also valid); Bearer for that product's API; shown once
  key_id: string;              // for revoke
  workspace: { id: string; handle: string; name: string };  // product-local handle, never "slug"
  role: string;                // the person's role in that workspace, in the product's own words
  expires_at: string;          // RFC 3339, now + 24 h; re-minted while the grant lives
  source: 'account' | 'manual' | 'env';  // manual = pasted with --product-key; env = MAGIC_<P>_KEY, never stored
}

interface CliSessionsResponse {
  sessions: ProductSession[];  // one per workspace the person may reach, or one when workspace was given
  workspaces: { id: string; handle: string; name: string; role: string }[];  // for whoami
  user?: { id: string; display_name: string; email: string };  // optional; fills the grant's user ahead of a product whoami
}
```

Request: `Authorization: Bearer magic_…`, JSON `{ "workspace"?: "<handle>", "label": "magic on <hostname>" }`. Errors in the product envelope: 401 `grant_invalid` (CLI: not_logged_in, "Run `magic login`"), 403 `no_workspaces` (permission_denied, `details.reason`), 404 `workspace_not_found` (not_found, `details.kind: workspace`), 429. The CLI refuses a session whose key lacks the product's prefix or whose workspace has no handle. Once minted, an expired key is answered with 401 and an error code containing `expired` (e.g. `key_expired`): that, and only that, makes the CLI re-mint.

A key borrows the person's live authority: losing the role in the product disables the key at the next request (see [[DB-ACCESS-KEYS]] (sites server plan)).
