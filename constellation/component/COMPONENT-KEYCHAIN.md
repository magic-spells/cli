---
name: 'Keychain: one cross-platform credential store (service io.magicspells.cli) with a 0600 file fallback'
kind: library
status: planned
framework: typescript
connections:
  - DECISION-KEYRING-DEFAULT
  - DATATYPE-KEYCHAIN-ENTRY
  - DATATYPE-ACCOUNT-CLI-GRANT
  - DATATYPE-PRODUCT-SESSION
  - COMPONENT-LOGIN
  - FEATURE-KEYRING
  - DOC-SECURITY
---

# Keychain

Replaces pyramid-cli's `src/keychain.ts` (macOS `security` + `~/.config/pyramid/credentials.json`) and its copies in Sites, Marketing and `mspm`.

## Interface

```ts
interface CredentialStore {
  get(item: string): Promise<string | null>;   // never throws; unavailable → null
  set(item: string, secret: string): Promise<void>;
  delete(item: string): Promise<void>;         // idempotent
  list(): Promise<string[]>;                   // item names only, never values
  backend: 'keyring' | 'file';
}
```

## Behaviour

- Backend: the OS keyring through a maintained binding (macOS Keychain, Linux Secret Service, Windows Credential Manager); service `io.magicspells.cli`, one item per credential ([[DATATYPE-KEYCHAIN-ENTRY]]).
- Fallback: `~/.config/magic/credentials.json` (XDG on Linux, `%APPDATA%\magic` on Windows), written with mode 0600, plus a stderr warning naming the file. Chosen when the binding fails to load or the keyring refuses, or when `MAGIC_CREDENTIALS_FILE=1`.
- R0 ships pyramid-cli's macOS `security` path under the new service name; R1 swaps in the binding ([[FEATURE-KEYRING]]).
- Secrets never reach argv (pyramid-cli passes the key to `security -w` in argv; the binding removes that).
