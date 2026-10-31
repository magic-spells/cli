---
name: PyramidConfig
status: built
connections:
  - DOC-PACKAGING
  - DOC-ONBOARDING
  - DOC-PACKAGE-RENAME
  - FILE-CONFIG
  - DOC-CREDENTIAL-STORAGE
  - FLOW-CREDENTIAL-RESOLUTION
---

Startup configuration read once by [[FILE-CONFIG]] and shared by both surfaces (MCP + CLI).

The API key is never accepted as a CLI flag. It resolves in this order: `PYRAMID_API_KEY` env -> OS keychain -> clear startup error. The env var remains the override for CI/headless clients and MCP configs that explicitly inject secrets; the keychain is the preferred local at-rest store ([[DOC-CREDENTIAL-STORAGE]], [[FLOW-CREDENTIAL-RESOLUTION]]).

```ts
interface PyramidConfig {
  apiKey: string;            // resolved "pyk_<prefix>_<secret>" from env or keychain
  baseUrl: string;           // PYRAMID_BASE_URL — default "https://api.pyramid.magicspells.io"
  allowDestructive: boolean; // PYRAMID_ALLOW_DESTRUCTIVE === "1" (default false)
}
```

The destructive gate is `PYRAMID_ALLOW_DESTRUCTIVE=1` because it applies to both the MCP and CLI surfaces.
