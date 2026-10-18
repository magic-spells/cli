---
name: 'Product session: a product-local key minted from the Account grant, scoped to one workspace'
status: planned
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - API-SITES-CLI-SESSIONS
  - API-PYRAMID-CLI-SESSIONS
  - API-MARKETING-CLI-SESSIONS
  - FLOW-PRODUCT-SESSION-MINT
  - COMPONENT-LOGIN
  - COMPONENT-KEYCHAIN
  - DATATYPE-KEYCHAIN-ENTRY
---

The response body of every product's `POST /v1/cli/sessions`, stored as-is plus `source`.

```ts
interface ProductSession {
  product: 'pyramid' | 'sites' | 'marketing';
  key: string;                 // pyk_… | pk_… | pmk_live_…; Bearer for that product's API
  key_id: string;              // for revoke
  workspace: { id: string; handle: string; name: string };
  role: string;                // the person's role in that workspace, in the product's own words
  expires_at: string;          // short-lived (product decides; plan default 24 h), re-minted while the grant lives
  source: 'account' | 'manual';  // manual = pasted with --product-key, never re-minted
}

interface CliSessionsResponse {
  sessions: ProductSession[];  // one per workspace the person may reach, or one when workspace was given
  workspaces: { id: string; handle: string; name: string; role: string }[];  // for whoami
}
```

A key borrows the person's live authority: losing the role in the product disables the key at the next request (see [[DB-ACCESS-KEYS]] (sites server plan)).
