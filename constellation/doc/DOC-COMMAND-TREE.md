---
name: 'Command tree: every magic command, by release'
kind: guide
status: planned
connections:
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
  - DECISION-NOT-FOR-FRAMEWORKS
  - COMPONENT-SHELL
  - FEATURE-WHOAMI-DOCTOR
  - DOC-OPERATION-AUTHORING
notes:
  - kind: decision
    text: >-
      2026-11-15, three changes to the planned tree. (1) `magic app …` became `magic sites app …`
      inside the Sites tree. Cory: “"magic app" should NEVER run something for sites” and
      “everything should be scoped, so "magic sites app"”. (2) The theme-folder commands moved from
      bare `magic sites init | check | migrate | dev` to `magic sites theme …`: Cory asked for
      `magic sites theme dev` and chose to move all four. The engine-side naming is
      DOC-OPEN-DECISIONS row 12. (3) `magic pyramid whoami` leaves the CLI and identity is
      root-only. Cory: “I think whoami can just be at the root under "magic whoami" right? the
      identity doesn't change, it's all tied to one account”. Also on 2026-11-15 the Pyramid list
      was matched to the built 0.3.1 tree and the removed `--no-cache` flag was dropped.
---

# Command tree

Product commands are derived from each registry; this card is the intended shape, not a hand-kept list. Operation names in parentheses.

## Top level (the person and the family)

| Command | Release | Does |
|---|---|---|
| `magic login [--device] [--product <p>] [--yes]` | R1 | Sign in to Account (browser or code); mint product sessions |
| `magic login --product-key [<product>]` | R0 | Store a pasted product key (CI) |
| `magic logout [--product <p>]` | R0, R1 | Revoke and forget credentials (R1: product keys revoked server-side, grant revoked) |
| `magic whoami` | R0, R1 | Account identity + workspaces per product |
| `magic doctor` | R0, R1 | Environment, Account and sign-in, credentials, product reachability, engine |
| `magic mcp [--products a,b]` | R0 | The MCP server |
| `magic update [--check] [--json]` | R4 (built in 0.3.0) | Update the CLI; plus the daily update notice |
| `magic telemetry on\|off\|status` | R4 | Consent |
| `magic version` / `--version` | R0 | Version |

Global flags: `--json`, `--yes/-y`, `--no-color`, `--quiet/-q`, `--workspace <handle>` (picks the product session; R1). `--product-key` is a `login` flag, not a global one.

Identity is root-only. Every product has a `<product>.whoami` operation, which `magic whoami` runs and prints under that product and `magic doctor` runs to prove the key works; no product has a `magic <product> whoami` command.

## `magic pyramid …` (R0)

`project list`; `project workflow <project>`; `task list-mine` (alias `next`); `task list <project>`; `task get <task>` (alias `show`); `task timeline <task>`; `task search <query>`; `task create <title>`; `task create-bulk <project>` (alias `bulk`); `task update <task>`; `task move <task>`; `task archive <task>`; `task delete <task>`; `task comment <task> <content>`; `comment reply <comment_id> <content>`; `comment list <task>` — 16 commands, the pyramid-cli tree under `pyramid.<noun>.<verb>` names (`pyramid.task.list-mine`, …). `magic pyramid login` existed in R0 only; R1 removed it (`magic login` mints Pyramid keys).

`pyramid.whoami` is an operation on the MCP surface only (`meta.surfaces: ['mcp']`), not a command: over MCP, `pyramid_whoami`, the `pyramid://me` resource and the `pyramid_doctor` setup prompt tell an agent which user, workspace and projects it acts on. Planned: 0.3.1 still exposes `magic pyramid whoami`.

`magic sites` and `magic marketing` exist from R1 as sign-in-only namespaces (no commands; `--help` lists none) so login, whoami and logout cover them.

## `magic sites …` (R2)

From the engine catalogue (59 tools on 2026-10-16): `version`; `pull`, `push`, `data pull`; `theme init | check | migrate | dev` (the local theme folder); `theme list | pull | push | duplicate | publish | delete | preview | schema | deployments | deploy | restore`; `pages list | get | create | update | publish | unpublish | delete`; `menus list | get | set`; `galleries list | get | set`; `entries …`; `types …`; `designs …`; `site publish | preview | snapshot`. Sites' own `login` and `keys` are not exposed (credentials belong to `magic login`); `mcp` is not a subcommand.

There is no bare `magic sites dev`, `check`, `init` or `migrate`: with `magic sites app init | check | dev` beside them, a bare `magic sites dev` would be ambiguous between a theme and an app. The engine names these four `init`, `check`, `migrate` and `dev` today (plus MCP-only `dev.stop`); how they reach `theme …` is open ([[DOC-OPEN-DECISIONS]] row 12).

Site-scoped commands address a site with `--site <handle or ID>`; there is no default-site setting yet. On `theme dev` it is optional: with `--site` the local server renders against that site's own data from the API (`--theme <handle>`, `--draft` (default) or `--published`, `--refresh` to re-pull the snapshot); without it, fixtures. `theme dev` also takes the theme directory (default `.`), `--addr` (default `127.0.0.1:3000`), `--open` and `--build`.

### `magic sites app …` (R3)

`init | dev | check | version | publish | install | logs | events replay | import` (the App SDK plan's set), operations `sites.app.<verb>`, MCP `sites_app_<verb>` ([[COMPONENT-APP-PACKAGE]]). There is no top-level `magic app`.

## `magic marketing …` (R4)

`contacts get | list | upsert`; `events track`; `campaigns list`; `flows list`; `lists list`; `segments list`; `reports summary`.

## Never here

Puzzle and framework commands ([[DECISION-NOT-FOR-FRAMEWORKS]]); operator tools (`sites-internal`, `accountctl`, `mspm`) unless [[DOC-OPEN-DECISIONS]] says otherwise.
