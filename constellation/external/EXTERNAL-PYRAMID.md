---
name: 'Pyramid: the project tracker API'
kind: external-microservice
status: planned
vendor: Magic Spells
purpose: Pyramid operations over HTTP with a workspace-scoped pyramid_ key; the CLI session route
docs_url: https://api.pyramid.magicspells.io
credentials_envs:
  - MAGIC_PYRAMID_KEY
connections:
  - DECISION-PYRAMID-CLI-IS-THE-BASE
  - COMPONENT-PYRAMID-PACKAGE
  - API-PYRAMID-CLI-SESSIONS
  - FEATURE-PYRAMID-MOVE
  - FEATURE-PRODUCT-SESSIONS
  - DIAGRAM-ARCHITECTURE
---

# Pyramid

Repo `pyramid` (`server/`, `pyramid/` web, `pyramid-cli/`, mobile apps). API host `https://api.pyramid.magicspells.io`; web `https://pyramid.magicspells.io`.

- Auth: `Authorization: Bearer pyramid_<8>_<32>`, workspace-pinned; keys from Settings → API Keys or the web `/auth/cli` page, which POSTs the key in a urlencoded body to the CLI's loopback listener (never in the URL).
- Error envelope `{ "error": { code, message, details } }`; 409 `conflict` for stale `If-Match`.
- `magic` needs the Pyramid half of [[FEATURE-PRODUCT-SESSIONS]].
