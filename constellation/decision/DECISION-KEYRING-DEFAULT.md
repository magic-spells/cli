---
name: 'Keyring by default: one service io.magicspells.cli in the OS credential store; 0600 file fallback with a warning'
status: built
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - COMPONENT-KEYCHAIN
  - DATATYPE-KEYCHAIN-ENTRY
  - FEATURE-KEYRING
  - DOC-SECURITY
  - DOC-OPEN-DECISIONS
---

# Keyring by default

## Context

Four hand-rolled macOS-only wrappers around `/usr/bin/security` exist, with four service names: `dev.sites.cli` (Sites, one JSON blob under account `credentials`), `pyramid` (account `default`), `magic-spells-marketing`, and `io.magicspells.mspm` (operator tool, one item per setting). Off macOS every one falls back to a plaintext 0600 JSON file (research §5.5; `pyramid/pyramid-cli/src/keychain.ts`). There is no Linux Secret Service or Windows Credential Manager support anywhere. The reference CLIs differ: one keeps the keyring as default with an explicit insecure-file opt-out; another made the keyring opt-in in 2026 (see [[DOC-REFERENCE-MODELS]]).

## Decision

- One store: the OS credential store through a maintained cross-platform binding — macOS Keychain, Linux Secret Service (libsecret), Windows Credential Manager. Library choice is open ([[DOC-OPEN-DECISIONS]]).
- One service name, `io.magicspells.cli`; one item per credential ([[DATATYPE-KEYCHAIN-ENTRY]]): `account:grant`, `pyramid:<workspace>`, `sites:<workspace>`, `marketing:<workspace>`.
- The keyring is the default. When it is unavailable (headless Linux without a Secret Service, some containers), `magic` writes `~/.config/magic/credentials.json` with mode 0600 and prints a one-line warning on stderr each time it does; `MAGIC_CREDENTIALS_FILE=1` chooses the file on purpose and silences the warning.
- Environment variables win over the store for CI: `MAGIC_PYRAMID_KEY`, `MAGIC_SITES_KEY`, `MAGIC_MARKETING_KEY` (names final in [[DATATYPE-CLI-CONFIG]]).
- `magic` does not read the old per-product stores. Pyramid's and Marketing's have no users to migrate; `dev.sites.cli` stays the standalone `sites` binary's own store.

## Alternatives

- **Keep `/usr/bin/security` and the file elsewhere.** Rejected: Linux and Windows users get plaintext by default.
- **File by default, keyring opt-in.** Rejected: secrets at rest in plaintext are the wrong default for a tool that holds keys to several products.
- **Import the old stores.** Rejected: no launched users; importing would keep four code paths alive.

## Consequences

- The binding's prebuilt binaries must cover every platform the CLI supports; a missing prebuild degrades to the file with the warning, never a crash.
- Keyring tests need Linux and Windows CI runners (open row in [[DOC-OPEN-DECISIONS]]).
- `mspm`'s store is out of scope: it is an operator tool that does not move into `magic`.
