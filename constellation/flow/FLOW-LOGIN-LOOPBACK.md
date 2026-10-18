---
name: 'magic login with a loopback browser callback (desktop)'
status: planned
triggers:
  - kind: manual
connections:
  - API-ACCOUNT-DEVICE-AUTHORIZATION
  - COMPONENT-LOGIN
  - FLOW-PRODUCT-SESSION-MINT
  - FLOW-LOGIN-DEVICE
  - DIAGRAM-LOGIN
---

# Login with a loopback callback

Used when a browser is local and `--device` is not given. The loopback server pattern is pyramid-cli's `src/auth-commands.ts` (`server.listen(0, '127.0.0.1')`, `state` check, browser open, 2-minute timeout); the endpoint changes from Pyramid's `/auth/cli` to Account's `/auth/authorize`.

1. **cli**: generates `state` (24 random bytes, base64url) and a PKCE verifier; starts an HTTP server on `127.0.0.1:0`.
2. **cli**: opens `https://account.magicspells.io/auth/authorize?client_id=…&redirect_uri=http://127.0.0.1:<port>/callback&state=…&code_challenge=…&code_challenge_method=S256&scope=basic`. If the browser does not open, prints the URL and keeps listening.
3. **account**: sign-in if needed, then the explicit confirm on `/auth/continue`; redirects to the loopback URL with `code` and `state` (allowed by the `cli`-kind loopback exception).
4. **cli**: checks `state`, exchanges `code` + `code_verifier` on `POST /auth/token` within 30 s, answers the browser with a "You can close this tab" page.
5. **cli**: stores the grant and runs [[FLOW-PRODUCT-SESSION-MINT]], as in [[FLOW-LOGIN-DEVICE]] steps 5–7.

- Timeout (2 minutes) or `error=access_denied` → nothing stored, exit 3, with a hint to try `magic login --device`.
- Requests to any path but `/callback`, or with a wrong `state`, get 400 and are ignored.
