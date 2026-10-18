---
name: 'magic login with the device flow'
status: planned
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
