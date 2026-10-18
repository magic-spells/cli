---
name: 'Account device authorization (RFC 8628): POST /auth/device, the /device verification page, device_code grant on POST /auth/token'
status: planned
path: /auth/device
methods:
  POST: {}
connections:
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - DATATYPE-ACCOUNT-CLI-GRANT
  - FEATURE-ACCOUNT-CLI-KIND
  - FEATURE-DEVICE-LOGIN
  - FLOW-LOGIN-DEVICE
  - FLOW-LOGIN-LOOPBACK
  - COMPONENT-LOGIN
  - EXTERNAL-ACCOUNT
---

# Account device authorization

**Lands in:** account (org/admin server: new handler beside `/auth/authorize` and `/auth/token`; a `/device` page in the Account web app; a `device_codes` table)

Adds the device-authorization grant to Account for `cli`-kind applications only. Today Account has no device grant and refuses loopback callbacks (research §3; see [[API-AUTH-TOKEN]] and [[FEATURE-PHASE-5-NATIVE-HANDOFF]] (account plan)).

## `POST /auth/device`

- Auth: none (public client). Form-encoded like `/auth/token`: `client_id` (must be a `cli`-kind application), `scope=basic`.
- 200:

```json
{
  "device_code": "<opaque, 32 bytes>",
  "user_code": "WDJB-MJHT",
  "verification_uri": "https://account.magicspells.io/device",
  "verification_uri_complete": "https://account.magicspells.io/device?code=WDJB-MJHT",
  "expires_in": 600,
  "interval": 5
}
```

- `user_code`: 8 characters from a 20-letter consonant alphabet, dash in the middle, single use.
- Errors: 400 `invalid_client` (unknown or not `cli` kind), 429 `slow_down` per IP.

## `/device` (Account web page)

- Signed-in person types or confirms the `user_code`, sees the application name ("Magic CLI"), the requesting IP's rough location and the time, and approves or denies. Same explicit-confirm rule as `/auth/continue`.

## `POST /auth/token` with `grant_type=urn:ietf:params:oauth:grant-type:device_code`

- Form: `grant_type`, `device_code`, `client_id`.
- 200 (approved): the existing grant shape `{token_type: "Bearer", access_token, expires_in: 5184000, grant_id}`; grant kind `cli`.
- 400 errors per RFC 8628: `authorization_pending`, `slow_down` (client adds 5 s to its interval), `access_denied`, `expired_token`.

## Loopback exception (same feature)

- `ValidHandoffCallback` accepts `http://127.0.0.1:{port}/callback` and `http://[::1]:{port}/callback`, any port, **only** for `cli`-kind applications. PKCE S256 stays mandatory; `/auth/token` with `grant_type=authorization_code` is unchanged.
