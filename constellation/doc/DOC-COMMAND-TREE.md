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

Global flags: `--json`, `--yes/-y`, `--no-color`, `--quiet/-q`, `--no-cache`, `--workspace <handle>` (picks the product session; R1). `--product-key` is a `login` flag, not a global one.

## `magic pyramid …` (R0)

`whoami`; `project list`; `project workflow`; `task next | list | get | create | create-bulk | update | move | archive | delete | timeline`; `task comment`, `comment reply` — the current pyramid-cli tree under the new names (`pyramid.task.next`, …). `magic pyramid login` existed in R0 only; R1 removed it (`magic login` mints Pyramid keys).

`magic sites` and `magic marketing` exist from R1 as sign-in-only namespaces (no commands; `--help` lists none) so login, whoami and logout cover them.

## `magic sites …` (R2)

From the engine catalogue (59 tools on 2026-10-16): `check`, `init`, `migrate`, `dev`, `version`; `pull`, `push`, `data pull`; `theme list | pull | push | duplicate | publish | delete | preview | schema | deployments | deploy | restore`; `pages list | get | create | update | publish | unpublish | delete`; `menus list | get | set`; `galleries list | get | set`; `entries …`; `types …`; `designs …`; `site publish | preview | snapshot`. Sites' own `login` and `keys` are not exposed (credentials belong to `magic login`); `mcp` is not a subcommand.

## `magic app …` (R3)

`init | dev | check | version | publish | install | logs | events replay | import` (the App SDK plan's set).

## `magic marketing …` (R4)

`contacts get | list | upsert`; `events track`; `campaigns list`; `flows list`; `lists list`; `segments list`; `reports summary`.

## Never here

Puzzle and framework commands ([[DECISION-NOT-FOR-FRAMEWORKS]]); operator tools (`sites-internal`, `accountctl`, `mspm`) unless [[DOC-OPEN-DECISIONS]] says otherwise.
