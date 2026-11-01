---
name: 'Kit (packages/kit): the shared core extracted from pyramid-cli — config, keychain, argv, render, errors, cache, MCP builder, doctor'
kind: library
status: built
framework: typescript
connections:
  - COMPONENT-KEYCHAIN
  - COMPONENT-RENDER
  - COMPONENT-OPERATION-REGISTRY
  - COMPONENT-MCP-AGGREGATOR
  - COMPONENT-UPGRADE
  - COMPONENT-TELEMETRY
  - DATATYPE-CLI-CONFIG
  - DATATYPE-ERROR-ENVELOPE
  - DATATYPE-OPERATION
  - FEATURE-KIT-EXTRACTION
  - DECISION-PYRAMID-CLI-IS-THE-BASE
notes:
  - kind: state
    text: >-
      2026-10-31: shipped in magic-spells 0.1.0 and extended in 0.2.0 (account, loopback, sessions,
      credentials modules) and 0.2.1 (zod 4). Every row of the table is built except `update,
      telemetry`, which arrive with COMPONENT-UPGRADE / COMPONENT-TELEMETRY (R4, planned); the
      keychain row is still the R0 backend (FEATURE-KEYRING planned).
---

# Kit

`packages/kit` is what every product package imports and nothing else does. It is private (never published on its own) and has no product names in it. Copied from pyramid-cli module by module ([[FEATURE-KIT-EXTRACTION]]).

| Module | From pyramid-cli | Becomes |
|---|---|---|
| config | `src/config.ts` (env → keychain → error, `PYRAMID_BASE_URL`) | per-product base URLs and credentials from env, then the config file, then the store ([[DATATYPE-CLI-CONFIG]]) |
| keychain | `src/keychain.ts` (`/usr/bin/security`, service `pyramid`) | [[COMPONENT-KEYCHAIN]] |
| operation | `Operation` / `OpContext` in `src/operations/index.ts` | [[DATATYPE-OPERATION]], [[COMPONENT-OPERATION-REGISTRY]] |
| argv | `src/cli/index.ts` zod introspection, `parseGlobals` | flag derivation for any registry |
| render | `src/cli/render.ts` | [[COMPONENT-RENDER]] |
| errors | `src/errors.ts` (`McpError`, `mapHttpError`, `toMcpError`) | `MagicError` and the HTTP mapper ([[DATATYPE-ERROR-ENVELOPE]]) |
| cache | the Map + timestamp cache in `src/cache/resolver.ts` | a TTL cache primitive; resolvers stay in products |
| hydrate | `src/hydrate.ts` helpers | defensive raw-row readers (`rec`, `readStr`); product joins stay in products |
| mcp | `src/mcp/server.ts` | the MCP builder used by [[COMPONENT-MCP-AGGREGATOR]] |
| http | `src/client/pyramid-client.ts` transport parts (undici, retries) | a JSON HTTP client with the auth header and error mapping |
| doctor | `bin/pyramid.ts` doctor path | a check runner each product contributes checks to |
| update, telemetry | new (Puzzle's D76 pattern) | [[COMPONENT-UPGRADE]], [[COMPONENT-TELEMETRY]] |

## Rules

- No module imports a product package.
- Every exported function takes its side effects injected (pyramid-cli's `AuthIO` style) so tests run without a keychain, network or TTY.
