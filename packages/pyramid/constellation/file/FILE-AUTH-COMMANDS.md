---
name: src/auth-commands.ts
status: built
path: src/auth-commands.ts
language: typescript
summary: Local credential commands (set-key / show-key / logout / login) for the pyramid bin.
connections:
  - FILE-KEYCHAIN
  - FILE-BIN
  - DOC-CREDENTIAL-STORAGE
  - FLOW-CLI-BROWSER-LOGIN
---

Local credential commands for the `pyramid` bin ([[DOC-CREDENTIAL-STORAGE]]). They manage the keychain-stored API key and do not require an existing Pyramid API key, so [[FILE-BIN]] dispatches to them before config load. [[FILE-CONFIG]] later reads the stored key.

```ts
export function maskKey(key: string): string;                  // pyk_<prefix>_...<last4> (never the full secret)
export function runSetKey(argv, io?): number;                  // pyramid set-key <pyk_...>
export function runShowKey(argv, io?): number;                 // pyramid show-key (masked status)
export function runLogout(argv, io?): number;                  // pyramid logout (deleteKey)
export function runLogin(argv, io?): Promise<number>;          // pyramid login browser handoff -> keychain
export type AuthCommand = (argv) => number | Promise<number>;
export const AUTH_COMMANDS: Record<string, AuthCommand>;       // incl. aliases set-api-key / set-token
```

- Side effects (keychain, output, browser open, env, random state, timeout) are injected through `AuthIO`, so handlers are unit-tested without touching the real keychain or launching a real browser.
- `pyramid login` starts a loopback callback server, opens `/auth/cli` in the web app, validates `state`, stores a returned `pyk_` key with [[FILE-KEYCHAIN]], and prints only the masked key.
- `PYRAMID_WEB_URL` or `pyramid login --web-url <url>` targets a dev/staging web app; production defaults to `https://pyramid.magicspells.io`.
- Each handler returns a process exit code; [[FILE-BIN]] owns `process.exit`. Output is stderr-only. The full secret is never printed.
