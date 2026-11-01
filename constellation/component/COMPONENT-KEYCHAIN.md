---
name: 'Keychain: one cross-platform credential store (service io.magicspells.cli) with a 0600 file fallback'
kind: library
status: building
framework: typescript
connections:
  - DECISION-KEYRING-DEFAULT
  - DATATYPE-KEYCHAIN-ENTRY
  - DATATYPE-ACCOUNT-CLI-GRANT
  - DATATYPE-PRODUCT-SESSION
  - COMPONENT-LOGIN
  - FEATURE-KEYRING
  - DOC-SECURITY
notes:
  - kind: gotcha
    text: >-
      R0's macOS backend (packages/kit/src/keychain.ts) shells out to `/usr/bin/security
      add-generic-password -w <secret>`, so the secret sits in argv for the duration of that call
      and is briefly visible to local processes. Inherited unchanged from pyramid-cli's keychain.ts
      and accepted for R0 (piping the password on stdin is unreliable: `security` prompts for it
      twice). FEATURE-KEYRING's binding closes it.
  - kind: state
    text: >-
      2026-10-31: planned → building. Shipped since magic-spells 0.1.0
      (packages/kit/src/keychain.ts): service `io.magicspells.cli`, macOS `/usr/bin/security`
      backend, 0600 file fallback with a stderr warning, `MAGIC_CREDENTIALS_FILE=1`. Not built: the
      cross-platform binding (Linux Secret Service, Windows Credential Manager) and
      secrets-out-of-argv — FEATURE-KEYRING, still planned — so the card stays building, not built.
  - kind: gotcha
    text: >-
      `security find-generic-password -w` prints the stored value as a lowercase hex string (not the
      text) whenever it contains any non-ASCII byte, e.g. a grant whose user.display_name is "José"
      or a workspace named "Café". Before 0.3.1 the reader returned that hex as-is, so JSON.parse
      failed and the user looked logged out right after `magic login`. The macOS reader now decodes
      output that is even-length lowercase hex, round-trips through Buffer, and is valid UTF-8
      (fatal TextDecoder); anything else is returned unchanged. Safe because none of our stored
      values is itself pure hex (product keys carry a prefix, the grant starts with `magic_`, JSON
      starts with `{`). Verified against the real `security` binary with a throwaway service.
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
