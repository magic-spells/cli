---
name: 'Keychain entry: one item per credential under service io.magicspells.cli'
status: planned
connections:
  - DECISION-KEYRING-DEFAULT
  - COMPONENT-KEYCHAIN
  - DATATYPE-ACCOUNT-CLI-GRANT
  - DATATYPE-PRODUCT-SESSION
---

Service `io.magicspells.cli`. The item name is the keyring "account" field; the value is a JSON string.

| Item | Value |
|---|---|
| `account:grant` | [[DATATYPE-ACCOUNT-CLI-GRANT]] |
| `pyramid:<workspace handle>` | [[DATATYPE-PRODUCT-SESSION]] |
| `sites:<workspace handle>` | [[DATATYPE-PRODUCT-SESSION]] |
| `marketing:<workspace handle>` | [[DATATYPE-PRODUCT-SESSION]] |
| `<product>:manual` | a pasted product key (`--product-key`), same shape with `source: "manual"` |

```ts
type KeychainItem = `account:grant` | `${'pyramid' | 'sites' | 'marketing'}:${string}`;
```

The file fallback stores the same map as `{ "items": { "<item>": "<json value>" } }`, mode 0600.
