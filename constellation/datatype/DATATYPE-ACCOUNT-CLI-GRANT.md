---
name: 'Account CLI grant: the identity-only opaque grant from the cli application kind'
status: planned
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - API-ACCOUNT-DEVICE-AUTHORIZATION
  - API-ACCOUNT-CLI-INTROSPECT
  - COMPONENT-LOGIN
  - COMPONENT-KEYCHAIN
  - DATATYPE-KEYCHAIN-ENTRY
---

What the CLI stores after a device or loopback login. The token is Account's opaque grant (no JWT; DECISION-OPAQUE-SESSIONS, account plan); the CLI never inspects it.

```ts
interface AccountCliGrant {
  access_token: string;        // opaque; Bearer for /v1/cli/sessions on every product
  grant_id: string;
  token_type: 'Bearer';
  obtained_at: string;         // ISO-8601
  expires_at: string;          // obtained_at + expires_in (60 days absolute)
  user: {                      // from the identity-only introspection answer, cached for whoami
    id: string;
    display_name: string;
    email: string;
  };
  account_url: string;         // which Account issued it (prod vs staging)
}
```

No entitlements, no `paid`, no product data: authority lives in the product sessions. 14 days without use ends it (Account's idle rule); `magic whoami` reports the expiry.
