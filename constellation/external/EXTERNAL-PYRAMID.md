---
name: 'Pyramid: the project tracker API'
kind: external-microservice
status: built
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
---

# Pyramid

Repo `magic-spells/pyramid` (`server/`, `web/`, `admin/`). API and web share one host, `https://pyramid.magicspells.io`; `MAGIC_PYRAMID_URL` overrides.

- Auth: `Authorization: Bearer pyramid_<8>_<32>`, workspace-pinned; `magic login` mints keys through [[API-PYRAMID-CLI-SESSIONS]], or a key from Settings → API Keys is pasted with `--product-key` or set as `MAGIC_PYRAMID_KEY`.
- Error envelope `{ "error": { code, message, details } }`; 409 `conflict` for stale `If-Match`.
