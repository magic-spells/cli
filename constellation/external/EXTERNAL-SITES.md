---
name: 'Magic Spells Sites: the sites engine binary and the /v1 API'
kind: external-microservice
status: planned
vendor: Magic Spells
purpose: 'Sites operations through the bundled engine binary; the CLI session route on sites-api'
connections:
  - DECISION-SITES-VIA-BINARY-ADAPTER
  - COMPONENT-SITES-ADAPTER
  - COMPONENT-SITES-ENGINE-PACKAGES
  - API-SITES-CLI-SESSIONS
  - API-SITES-OPS-CATALOGUE
  - FEATURE-SITES-ENGINE-CHANGES
  - FEATURE-PRODUCT-SESSIONS
  - DIAGRAM-ARCHITECTURE
---

# Magic Spells Sites

Repo `sites` (private): `engine/` (Go `sites` binary, `ops` registry, `sites mcp`), `server/` (`sites-api` `/v1`, `sites-internal`), `web/`, `admin/`.

## Today (research §1–2)

- `sites` CLI: stdlib `flag`, 59 MCP tools, `--json`, exit 0/1/2; credentials in `internal/keychain` (macOS service `dev.sites.cli`, else `$XDG_CONFIG_HOME/sites/credentials.json`); `SITES_API` host override; `SITES_TOKEN` read only by `login`.
- `sites-api` accepts the `__Secure-ms_session` cookie or a `pk_` key only (`server/internal/middleware/auth.go`); no Account grant path for non-browser clients.
- No tags, no release script, no OpenAPI.

## What `magic` needs

[[FEATURE-SITES-ENGINE-CHANGES]] (engine) and the Sites half of [[FEATURE-PRODUCT-SESSIONS]] (server).
