---
name: 'Sites adapter boot: find the engine, check its version, spawn sites mcp, build the registry'
status: planned
triggers:
  - kind: manual
connections:
  - COMPONENT-SITES-ADAPTER
  - COMPONENT-SITES-ENGINE-PACKAGES
  - API-SITES-OPS-CATALOGUE
  - DECISION-SITES-VIA-BINARY-ADAPTER
  - FEATURE-SITES-ADAPTER
---

# Sites adapter boot

1. **adapter**: path from `MAGIC_SITES_ENGINE`, else resolve `@magic-spells/sites-engine-<platform>-<arch>`. Missing → `product_unavailable` "Sites commands are not available on <platform>", exit 11.
2. **adapter**: catalogue cache `~/.cache/magic/sites-ops-<engine version>.json`. Hit → build operations from it without spawning (help and `tools/list` stay fast).
3. **adapter**: miss → run `sites ops --json` ([[API-SITES-OPS-CATALOGUE]]), check `catalogue_version` is one the adapter knows, write the cache.
4. **adapter**: build operations: name `sites.<op name>`, `input` = a zod schema built from `input_schema` (or a pass-through validator), `meta.destructive` and `surfaces` from the catalogue.
5. **adapter**, on the first `run`: spawn `sites mcp` with `SITES_TOKEN=<session key>`, `SITES_API=<config>`, stdin/stdout piped, stderr forwarded under `--verbose` only; `initialize`; compare the server version to the pinned one.
6. **adapter**: calls go over this child until the `magic` process exits; a crashed child is restarted once, then `product_unavailable`.

- A workspace switch (`--workspace`) changes the token, so the adapter keeps one child per workspace in use.
