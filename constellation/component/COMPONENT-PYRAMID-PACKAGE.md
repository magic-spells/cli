---
name: 'Pyramid package (packages/pyramid): pyramid-cli''s operations, client, resolver, hydration and MCP text'
kind: product-package
status: built
framework: typescript
connections:
  - DECISION-PYRAMID-CLI-IS-THE-BASE
  - COMPONENT-OPERATION-REGISTRY
  - COMPONENT-KIT
  - FEATURE-PYRAMID-MOVE
  - FLOW-MOVE-PYRAMID-CLI
  - API-PYRAMID-CLI-SESSIONS
  - EXTERNAL-PYRAMID
notes:
  - kind: state
    text: >-
      Built: src/index.ts default-exports the ProductModule (lazy operations import, client = { api:
      PyramidClient, resolver: Resolver }, globalFlags ['project'], commands.login, doctor checks,
      mcp instructions + register). 17 operations, not 16. The client keeps its own undici transport
      (no kit http module yet). Resolver caches run on the kit's TtlCache (60 s). src/doctor.ts
      exports the auth and workflow checks for `magic doctor`. src/login.ts is `magic pyramid login`
      (loopback, stores `pyramid:manual`).
    sha: 0304bf4
  - kind: state
    text: >-
      R1 (feat/r1-login, 2c25e3a): `magic pyramid login` and src/login.ts (+ tests) are removed,
      with MAGIC_PYRAMID_WEB_URL; the browser handoff to Pyramid's /auth/cli is no longer used by
      the CLI. The ProductModule declares `sessions: { path: '/v1/cli/sessions' }`, so `magic login`
      mints its pyk_ keys from the Account grant and the kit re-mints them on auth_expired.
      `pyramid.whoami` is also what fills the grant's `user` after login (the sessions answer
      carries no person). No `commands` map remains.
    sha: 2c25e3a
---

# Pyramid package

The whole current `pyramid` tree under `magic pyramid …`.

## Contents (from pyramid-cli)

- `operations/` — the 16 operations (`whoami`, projects, workflow, tasks read and write, comments), renamed `pyramid.<noun>.<verb>` (`list_my_tasks` → `pyramid.task.list-mine`, CLI `magic pyramid task next|update|comment` unchanged in shape).
- `client/` — `pyramid-client.ts` on the kit's HTTP client; base URL default `https://api.pyramid.magicspells.io`.
- `resolver/` — `src/cache/resolver.ts` precedence (project handle → name → fuzzy; status key → name → category → stage; user email → display name → fuzzy; label) and its 60 s workflow cache.
- `hydrate/` — the joins from `src/hydrate.ts` (status, stage, users, labels → names).
- `mcp/` — the INSTRUCTIONS text, resources and prompts.
- `doctor` checks — the auth ping and workflow ping from `bin/pyramid.ts`.

## Changes on the move

- `PYRAMID_ALLOW_DESTRUCTIVE` → `MAGIC_ALLOW_DESTRUCTIVE`; `PYRAMID_API_KEY` → `MAGIC_PYRAMID_KEY`; `--project` stays a Pyramid flag, `--workspace` is the kit's.
- `set-key | show-key | logout` move to `magic login --product-key`, `magic whoami`, `magic logout --product pyramid`.
- `magic pyramid whoami` keeps its product meaning (user, workspace, projects).
