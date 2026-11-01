---
name: 'magic login with the device flow'
status: built
triggers:
  - kind: manual
connections:
  - API-ACCOUNT-DEVICE-AUTHORIZATION
  - DATATYPE-ACCOUNT-CLI-GRANT
  - COMPONENT-LOGIN
  - COMPONENT-KEYCHAIN
  - FLOW-PRODUCT-SESSION-MINT
  - FEATURE-DEVICE-LOGIN
  - DIAGRAM-LOGIN
  - ROLE-DEVELOPER
notes:
  - kind: state
    text: >-
      Built on feat/r1-login against the fake Account. POST /auth/device form
      `client_id&scope=basic`; polls POST /auth/token form
      `grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code&client_id`. kit
      waitForDevice: waits `interval` in 1 s steps (countdown ticks), +5 s per slow_down, stops
      without another poll once expires_in has passed (auth_expired "The code expired", hint "Run
      `magic login` again."), access_denied → auth_cancelled, Ctrl-C (abort) → auth_cancelled,
      nothing stored. The CLI prints verification_uri and the user_code spaced and bold (also under
      --quiet), opens verification_uri_complete only when a browser is local (i.e. --device on a
      desktop), shows a `\r` countdown on a TTY and a single "Waiting for approval" line otherwise.
      Account's error body is read as either `{error:"code"}` (RFC) or `{error:{code}}` (Account's
      existing jsonError shape) because the device handler is not built yet.
    sha: 9d2583d
  - kind: state
    text: >-
      2026-10-31: shipped in magic-spells 0.2.0. Account's device handler is now merged (`POST
      /auth/device`, `/device`, lookup/confirm, device_code grant), so the flow no longer depends on
      the fake Account; the dual error-body parsing stays as a harmless tolerance.
---

# Login with the device flow

1. **cli**: `magic login` (or `--device`, or no local browser: `SSH_CONNECTION` set, no `DISPLAY` on Linux) calls `POST /auth/device` with the `magic` application's `client_id` ([[API-ACCOUNT-DEVICE-AUTHORIZATION]]).
2. **cli → stderr**: prints the `user_code` large, the `verification_uri`, and tries to open `verification_uri_complete` when a browser is available. Shows a spinner with the code's remaining time.
3. **person, any device**: opens `account.magicspells.io/device`, signs in if needed (Account's usual login), confirms the code and approves "Magic CLI".
4. **cli**: polls `POST /auth/token` with `grant_type=…device_code` every `interval` seconds.
   - `authorization_pending` → keep polling.
   - `slow_down` → add 5 s to the interval.
   - `access_denied` → "Login cancelled", exit 3.
   - `expired_token` → "Code expired, run magic login again", exit 3.
5. **cli**: on success stores the grant as `account:grant` ([[DATATYPE-ACCOUNT-CLI-GRANT]]) and fills `user` from the first product mint (or a `whoami` on any product).
6. **cli**: runs [[FLOW-PRODUCT-SESSION-MINT]] for every product.
7. **cli → stderr**: "Logged in as <name> (<email>)" and one line per product: workspaces reached, or why not.

- Ctrl-C during polling stores nothing.
- A second `magic login` while logged in asks to replace the grant (`--yes` skips the question) and revokes the old one after the new one works.
