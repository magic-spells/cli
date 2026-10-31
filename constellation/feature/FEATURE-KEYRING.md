---
name: 'Cross-platform keyring: macOS Keychain, Linux Secret Service, Windows Credential Manager; file fallback with a warning'
status: planned
release: RELEASE-1-LOGIN
change: feature
connections:
  - COMPONENT-KEYCHAIN
  - DATATYPE-KEYCHAIN-ENTRY
  - DECISION-KEYRING-DEFAULT
  - DOC-SECURITY
notes:
  - kind: gotcha
    text: >-
      R0's macOS backend (packages/kit/src/keychain.ts) shells out to `/usr/bin/security
      add-generic-password -w <secret>`, so the secret sits in argv for the duration of that call
      and is briefly visible to local processes. Inherited unchanged from pyramid-cli's keychain.ts
      and accepted for R0 (piping the password on stdin is unreliable: `security` prompts for it
      twice). The keyring binding this feature brings in closes it.
---

# Keyring

## Scope

- Replace the R0 `security` backend with a maintained binding (choice open in [[DOC-OPEN-DECISIONS]]); load it lazily so commands that need no credential never load native code.
- Fallback to the 0600 file with the stderr warning when the binding or the keyring fails; `MAGIC_CREDENTIALS_FILE=1` to choose it.
- One-time move of R0 items stored by the `security` backend into the binding (same service name, so usually a no-op on macOS).
- CI: keyring round-trip tests on macOS, Linux (a Secret Service under `dbus-run-session` with gnome-keyring) and Windows runners.

## Acceptance

- `magic login` on each OS stores items visible in the OS's own credential manager under `io.magicspells.cli`.
- On a Linux container with no Secret Service, login succeeds, writes the file with mode 0600 and prints the warning.
- No secret appears in argv of any child process (checked in a test that spies on spawn).
