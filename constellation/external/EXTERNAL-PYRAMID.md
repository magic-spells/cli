---
name: 'Pyramid: the project tracker API'
kind: external-microservice
status: planned
vendor: Magic Spells
purpose: Pyramid operations over HTTP with a workspace-scoped pyramid_ key; the CLI session route
docs_url: https://pyramid.magicspells.io
credentials_envs:
  - MAGIC_PYRAMID_KEY
connections:
  - DECISION-PYRAMID-CLI-IS-THE-BASE
  - COMPONENT-PYRAMID-PACKAGE
  - API-PYRAMID-CLI-SESSIONS
  - FEATURE-PYRAMID-MOVE
  - FEATURE-PRODUCT-SESSIONS
  - DIAGRAM-ARCHITECTURE
notes:
  - kind: state
    text: >-
      2026-10-31, 0.2.2: Pyramid's API is served on the web host `https://pyramid.magicspells.io`;
      `api.pyramid.magicspells.io` has no certificate and made the first real `magic login` skip
      Pyramid. The CLI default (`DEFAULT_API_URL`) is now `https://pyramid.magicspells.io`;
      `MAGIC_PYRAMID_URL` still overrides. The "API host" in the intro above is superseded by this
      note.
---

# Pyramid

Repo `pyramid` (`server/`, `pyramid/` web, `pyramid-cli/`, mobile apps). API host `https://api.pyramid.magicspells.io`; web `https://pyramid.magicspells.io`.

- Auth: `Authorization: Bearer pyramid_<8>_<32>`, workspace-pinned; keys from Settings → API Keys or the web `/auth/cli` page, which POSTs the key in a urlencoded body to the CLI's loopback listener (never in the URL).
- Error envelope `{ "error": { code, message, details } }`; 409 `conflict` for stale `If-Match`.
- `magic` needs the Pyramid half of [[FEATURE-PRODUCT-SESSIONS]].
