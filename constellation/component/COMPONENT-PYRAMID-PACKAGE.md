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
  - kind: decision
    text: >-
      2026-10-31: the key never travels in a URL. Pyramid web's /auth/cli POSTs `{ state, key, name
      }` (or `{ state, error }`) as a urlencoded body to the loopback callback; the listener refuses
      GET and any `key` in the query string. Why: URLs are logged (browser history, proxies, server
      logs). Rejected: the old GET with the key in the query string.
  - kind: state
    text: >-
      R1 (feat/r1-login, 2c25e3a; merged with release/0.2.0 at 5c53559): `magic pyramid login` and
      src/login.ts (+ tests) are removed, with MAGIC_PYRAMID_WEB_URL, so the POST-body loopback
      above (release/0.2.0) no longer ships in the CLI; the no-key-in-URL rule carries over to
      Account's loopback, which only ever receives a `code`. Keys are `pyramid_<8>_<32>`
      (PYRAMID_CREDENTIAL.credential = 'pyramid_'). The ProductModule declares `sessions: { path:
      '/v1/cli/sessions' }`, so `magic login` mints its pyramid_ keys from the Account grant and the
      kit re-mints them on auth_expired. The grant's `user` comes from an optional top-level `user`
      in a sessions answer, else from `pyramid.whoami`. No `commands` map remains.
    sha: 09b2af0
  - kind: decision
    text: >-
      2026-11-15: replaced "`magic pyramid whoami` keeps its product meaning". The operation stays,
      MCP-only; the CLI command is planned to go (one line in src/operations/index.ts, not made in
      0.3.1). Cory: “I think whoami can just be at the root under "magic whoami" right? the identity
      doesn't change, it's all tied to one account”.
  - kind: state
    text: >-
      PR #13, merged into release/0.3.2 on 2026-11-15, unreleased (npm has 0.3.1; ships with the
      next version). (1) `comment reply` takes `comment_id` and `content` only, no `mentions`: it
      POSTs the reply directly and hydrates against the reply's own `project_id`. The old pre-check
      called `GET /v1/comments/{id}`, a route the server never had, so every reply failed in every
      release; a reply to a reply now comes back as the server's 422, `validation_failed` (exit 7).
      Mentions on `task comment` are unchanged. (2) Statuses resolve inside their stage, in the
      resolver (`resolveStatus(project, status, stage?)`): the default seeded workflow repeats
      Initial / Review / Edits under both Discovery and Design. `task move` gained a `stage` input;
      a status not in the named stage is `not_found` (exit 5); an ambiguous status lists candidates
      as "Stage: Status" with the hint to pass `stage`. (3) `task create-bulk` is strict: rows
      accept exactly the server's bulk-row fields (title, description, stage, status, owner,
      reviewer, labels, custom_fields) and `defaults` only stage, status and labels; anything else
      is a validation error, not silently dropped. Per-row priority, due_date, estimate_hours and
      guest_visible are rejected (Cory chose "reject" on 2026-11-15; the bulk route has no such
      fields); single `task create` still takes them. (4) Labels: `task list` asks for
      `expand=owner,reviewer,labels` and carries real labels plus owner/reviewer details; `task
      search`, `task list-mine` and archived lists omit the `labels` key (those routes cannot
      expand) rather than claim none; `task update` re-reads with the same expand, so added labels
      show. (5) Server contract, checked against the Pyramid server source: custom-field updates
      PATCH `/tasks/{id}/field-values` with `{ values }`; labels are added in one request under
      `label_ids`; on `task move`, `before_id` is the record above the destination slot and
      `after_id` the one below (so "after X" sends X as before_id); the caller's project role is
      read from `my_role` in the resolver's one project normaliser.
    sha: 4fdc7f6
  - kind: decision
    text: >-
      2026-11-15, made by the orchestrator (Cory was told and has not objected): `comment reply`
      takes no `mentions`. Why: nothing maps a comment to its project before the write, and mention
      names resolve to user ids through that project's members. Rejected: an optional `task` input
      needed only with mentions (adds a guard); a required `task` argument (unused in the common
      case). Bringing reply mentions back needs a Pyramid server route that maps a comment to its
      project. Mentions on `task comment` are unchanged.
    sha: 4fdc7f6
---

# Pyramid package

The whole current `pyramid` tree under `magic pyramid …`.

## Contents (from pyramid-cli)

- `operations/` — the 16 operations (`whoami`, projects, workflow, tasks read and write, comments), renamed `pyramid.<noun>.<verb>` (`list_my_tasks` → `pyramid.task.list-mine`, CLI `magic pyramid task next|update|comment` unchanged in shape).
- `client/` — `pyramid-client.ts` on the kit's HTTP client; base URL default `https://pyramid.magicspells.io` (the API is served on the web host; 0.2.2).
- `resolver/` — `src/cache/resolver.ts` precedence (project handle → name → fuzzy; status key → name → category → stage; user email → display name → fuzzy; label) and its 60 s workflow cache.
- `hydrate/` — the joins from `src/hydrate.ts` (status, stage, users, labels → names).
- `mcp/` — the INSTRUCTIONS text, resources and prompts.
- `doctor` checks — the auth ping and workflow ping from `bin/pyramid.ts`.

## Changes on the move

- `PYRAMID_ALLOW_DESTRUCTIVE` → `MAGIC_ALLOW_DESTRUCTIVE`; `PYRAMID_API_KEY` → `MAGIC_PYRAMID_KEY`; `--project` stays a Pyramid flag, `--workspace` is the kit's.
- `set-key | show-key | logout` move to `magic login --product-key`, `magic whoami`, `magic logout --product pyramid`.
- `pyramid.whoami` (user, workspace, projects) is MCP-only (`meta.surfaces: ['mcp']`): `magic whoami` and `magic doctor` keep running it, and there is no `magic pyramid whoami` command ([[FEATURE-WHOAMI-DOCTOR]]). Built on release/0.3.2 and ships with the next version; the published 0.3.1 still exposes the command.
