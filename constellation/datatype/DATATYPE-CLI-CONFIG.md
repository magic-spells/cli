---
name: 'CLI config: environment variables, ~/.config/magic/config.json, and the resolved CliConfig'
status: built
connections:
  - COMPONENT-KIT
  - COMPONENT-SHELL
  - COMPONENT-TELEMETRY
  - DECISION-KEYRING-DEFAULT
notes:
  - kind: state
    text: >-
      2026-10-31: shipped in magic-spells 0.1.0 (packages/kit/src/config.ts), extended in 0.2.0 with
      `accountClientId` (MAGIC_ACCOUNT_CLIENT_ID, default `magic-cli`). As built `products` is a map
      keyed by product id; `updateCheck` and the Sites `engine` path are not built yet (R4 upgrade,
      R2 Sites adapter).
  - kind: state
    text: >-
      2026-10-31 correction to the note above: `updateCheck` IS resolved in config.ts (false under
      CI or MAGIC_NO_UPDATE_CHECK); only its consumer, the update notice, is unbuilt (R4). The Sites
      `engine` path is the field still missing.
  - kind: state
    text: >-
      2026-10-31 (feat/upgrade, release/0.3.0): the update notice now consumes `updateCheck` (the
      resolved boolean gates it). The config file gained `updateCheck: { checkedAt, latest }`, the
      cached registry check, written by the CLI (kit update.ts writeUpdateCheck keeps every other
      key). It is the only value the CLI writes to config.json.
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
