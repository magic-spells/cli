---
name: 'magic login with a loopback browser callback (desktop)'
status: built
triggers:
  - kind: manual
connections:
  - API-ACCOUNT-DEVICE-AUTHORIZATION
  - COMPONENT-LOGIN
  - FLOW-PRODUCT-SESSION-MINT
  - FLOW-LOGIN-DEVICE
  - DIAGRAM-LOGIN
notes:
  - kind: state
    text: >-
      Built on feat/r1-login, tested only against the fake Account (packages/kit/tests/fakes.ts).
      kit/src/loopback.ts: 127.0.0.1:0, only GET /callback with the expected state and a code ends
      it; other path/method/state or a missing code → 400 and keeps listening; a second callback
      while the exchange runs → 400. error=access_denied with the right state → auth_cancelled;
      other error values → auth_invalid. The exchange gets an AbortSignal of 30 s (code lifetime) +
      Ctrl-C. Replies carry `connection: close`; on settle the server closes and drops idle
      preconnects. Timeout 2 min → auth_expired with hint `magic login --device`. Exchange body:
      grant_type=authorization_code, code, code_verifier, client_id, redirect_uri (form-encoded). If
      the browser does not open, the authorize URL is printed to stderr and the listener keeps
      waiting. Other query params (e.g. a future `iss`) are ignored rather than refused.
    sha: 9d2583d
  - kind: state
    text: >-
      2026-10-31: shipped in magic-spells 0.2.0. Account's cli-kind loopback exception is merged and
      the application `magic-cli` is registered, so the flow runs against real Account rather than
      only the fake.
  - kind: state
    text: >-
      2026-10-31, 0.2.2: the loopback's browser answers (signed in, cancelled, failed, and the 400
      "Bad request.") are small static HTML pages from one template in packages/kit/src/loopback.ts:
      `text/html; charset=utf-8`, `cache-control: no-store`, CSP `default-src 'none'; style-src
      'unsafe-inline'`, no scripts or external assets, message centred, system fonts, light/dark via
      prefers-color-scheme, 16px gutters. Heading + the unchanged sentence. Texts are constants; the
      query string and errors are never interpolated (nothing is escaped, so keep it that way).
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
