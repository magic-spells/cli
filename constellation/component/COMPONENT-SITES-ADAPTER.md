---
name: 'Sites adapter (packages/sites): binary-backed registry over `sites mcp`, plus dev|check by shell-out'
kind: adapter
status: planned
framework: typescript
connections:
  - DECISION-SITES-VIA-BINARY-ADAPTER
  - DECISION-OPERATION-CONTRACT
  - COMPONENT-SITES-ENGINE-PACKAGES
  - COMPONENT-OPERATION-REGISTRY
  - COMPONENT-MCP-AGGREGATOR
  - API-SITES-OPS-CATALOGUE
  - API-SITES-CLI-SESSIONS
  - FLOW-SITES-ADAPTER-BOOT
  - FEATURE-SITES-ADAPTER
  - EXTERNAL-SITES
---

# Sites adapter

## What it does

1. Resolves the engine binary from the platform package ([[COMPONENT-SITES-ENGINE-PACKAGES]]); `MAGIC_SITES_ENGINE` overrides the path for development.
2. Checks `sites version` against the pinned version; a mismatch is `product_unavailable` with a hint.
3. On first use, spawns `sites mcp` over stdio with the Sites session key in its environment and `SITES_API` set from config; acts as an MCP client.
4. Reads `tools/list` (or the cached `sites ops --json` catalogue, [[API-SITES-OPS-CATALOGUE]]) and builds operations: tool `theme_push` → `sites.theme.push`, schema passed through, `Surfaces` honoured (`mcp`-only tools such as `dev stop` are not CLI commands; `cli`-only fields are not MCP inputs).
5. `run` = `tools/call`; an `IsError` result is parsed as `ops.Error{Code, Message, Hint}` and mapped to the envelope.
6. `magic sites dev` and `magic sites check` spawn `sites dev|check` with stdio inherited, so the engine's TTY behaviour (`r`+Enter refresh) is untouched.

## Error map (ops.Error → envelope class)

| Sites code | magic code | Exit |
|---|---|---|
| `unknown_operation` | `usage` | 2 |
| `invalid_input` | `validation_failed` | 7 |
| `theme_diagnostics` | `diagnostics` | 7 |
| `conflict` | `conflict` | 7 |
| `not_available` | `product_unavailable` | 11 |
| `failed` | `unknown` | 1 |
| API 401 / 403 / 404 / 429 | `auth_invalid` / `permission_denied` / `not_found` / `rate_limited` | 3 / 4 / 5 / 9 |

## Rules

- One child per `magic` process; it is shut down on exit.
- The adapter never parses human output from the binary.
