---
name: src/keychain.ts
status: built
path: src/keychain.ts
language: typescript
summary: OS keychain credential store (get/set/delete) — macOS `security`, file fallback, zero deps.
connections:
  - FILE-CONFIG
  - DOC-CREDENTIAL-STORAGE
  - FILE-AUTH-COMMANDS
---

OS keychain credential store — the shared read/write seam for the `pyk_` API key ([[DOC-CREDENTIAL-STORAGE]]). Local credential commands write; [[FILE-CONFIG]] reads.

```ts
export function getKey(): string | null;    // env-independent read; null on miss/error (never throws)
export function setKey(key: string): void;   // `pyramid set-key <pyk_...>`
export function deleteKey(): void;           // `pyramid logout` (idempotent)
```

- **macOS** (`process.platform === 'darwin'`): `execFileSync('/usr/bin/security', ...)` — `find` / `add -U` / `delete-generic-password`, service `pyramid`, account `default`. No native dependency.
- **Other platforms:** a `chmod 600` JSON file at `~/.config/pyramid/credentials.json`.
- `getKey` returns `null` (never throws) on a missing item, locked keychain, or `security` failure, so the `env -> keychain -> error` chain degrades cleanly. The key is never logged.
