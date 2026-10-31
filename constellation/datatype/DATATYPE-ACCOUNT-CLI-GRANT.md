---
name: 'Account CLI grant: the identity-only opaque grant from the cli application kind'
status: building
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - API-ACCOUNT-DEVICE-AUTHORIZATION
  - API-ACCOUNT-CLI-INTROSPECT
  - COMPONENT-LOGIN
  - COMPONENT-KEYCHAIN
  - DATATYPE-KEYCHAIN-ENTRY
---

What the CLI stores after a device or loopback login, as the `account:grant` item. The token is Account's opaque grant (no JWT; DECISION-OPAQUE-SESSIONS, account plan), prefixed `magic_`; the CLI never inspects it beyond that prefix.

```ts
interface StoredGrant {          // packages/kit/src/sessions.ts
  access_token: string;          // opaque `magic_…`; Bearer for /v1/cli/sessions on every product
  grant_id: string;
  token_type: 'Bearer';
  obtained_at: string;           // ISO-8601
  expires_at: string;            // obtained_at + expires_in (60 days absolute)
  last_used_at: string;          // last successful mint: Account's idle clock restarts on each introspection
  user?: {                       // from the first product whoami after the mint; absent until then
    id: string;
    display_name: string;
    email: string;
  };
  account_url: string;           // which Account issued it (prod vs staging)
}
```

No entitlements, no `paid`, no product data: authority lives in the product sessions. 14 days without use ends it (Account's idle rule); `magic whoami` reports `idle_expires_at` = min(last_used_at + 14 d, expires_at), an estimate because only Account knows the true idle clock.

`user` cannot come from the mint: the `/v1/cli/sessions` answer carries no person. The CLI runs the first minted product's `<id>.whoami` operation (Pyramid today) and reads `user` from it; with no such product the grant stays without a user and whoami shows "Signed in".
