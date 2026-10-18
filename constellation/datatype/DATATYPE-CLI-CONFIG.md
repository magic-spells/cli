---
name: 'CLI config: environment variables, ~/.config/magic/config.json, and the resolved CliConfig'
status: planned
connections:
  - COMPONENT-KIT
  - COMPONENT-SHELL
  - COMPONENT-TELEMETRY
  - DECISION-KEYRING-DEFAULT
---

Resolution order for every value: flag → environment → config file → default. Credentials: environment → store ([[DATATYPE-KEYCHAIN-ENTRY]]) → `not_logged_in`.

```ts
interface CliConfig {
  accountUrl: string;               // MAGIC_ACCOUNT_URL, default https://account.magicspells.io
  products: {
    pyramid:   { apiUrl: string };  // MAGIC_PYRAMID_URL, default https://api.pyramid.magicspells.io
    sites:     { apiUrl: string; engine?: string };  // MAGIC_SITES_URL (passed to the child as SITES_API), MAGIC_SITES_ENGINE
    marketing: { apiUrl: string };  // MAGIC_MARKETING_URL
  };
  defaultWorkspace: Partial<Record<ProductId, string>>;  // handle per product; --workspace wins
  allowDestructive: boolean;        // MAGIC_ALLOW_DESTRUCTIVE === '1', env only, never in the file
  telemetry: 'unset' | 'on' | 'off';
  updateCheck: boolean;             // false when CI or MAGIC_NO_UPDATE_CHECK
  output: { json: boolean; color: boolean; quiet: boolean; cache: boolean };
}
```

Credential environment variables (CI): `MAGIC_PYRAMID_KEY`, `MAGIC_SITES_KEY`, `MAGIC_MARKETING_KEY`, `MAGIC_APP_KEY`. They are read, never written, and never accepted as flag values.

The config file (`~/.config/magic/config.json`; `%APPDATA%\magic\config.json` on Windows) holds no secrets: default workspaces, telemetry answer, URLs for staging.
