---
name: 'Keychain entry: one item per credential under service io.magicspells.cli'
status: building
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
| `account:sessions` | the session index: per product `{ workspaces: [{id, handle, name, role}], default?: handle, minted_at }` |
| `pyramid:<workspace handle>` | [[DATATYPE-PRODUCT-SESSION]] |
| `sites:<workspace handle>` | [[DATATYPE-PRODUCT-SESSION]] |
| `marketing:<workspace handle>` | [[DATATYPE-PRODUCT-SESSION]] |
| `<product>:manual` | a pasted product key (`--product-key`), same shape with `source: "manual"` |

```ts
type KeychainItem = 'account:grant' | 'account:sessions' | `${'pyramid' | 'sites' | 'marketing'}:${string}`;
```

`account:sessions` exists because the store cannot list items (`security dump-keychain` is slow and prompts): logout, whoami and credential resolution read it to know which `<product>:<handle>` items exist and which is the default (set when a product minted exactly one workspace). It holds no secrets but lives in the store beside the items it indexes so the two cannot drift apart across machines or config resets.

The file fallback stores the same map as `{ "items": { "<item>": "<json value>" } }`, mode 0600.
