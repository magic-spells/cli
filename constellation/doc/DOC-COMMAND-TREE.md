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
| `magic login [--device] [--product <p>] [--product-key]` | R0 (`--product-key`), R1 (Account) | Sign in; mint product sessions |
| `magic logout [--product <p>]` | R0 | Revoke and forget credentials |
| `magic whoami` | R0, R1 | Account identity + workspaces per product |
| `magic doctor` | R0 | Environment, credentials, product reachability, engine |
| `magic mcp [--products a,b]` | R0 | The MCP server |
| `magic upgrade` | R4 | Update the CLI |
| `magic telemetry on\|off\|status` | R4 | Consent |
| `magic version` / `--version` | R0 | Version |

Global flags: `--json`, `--yes/-y`, `--no-color`, `--quiet/-q`, `--no-cache`, `--workspace <handle>`, `--product-key`.

## `magic pyramid …` (R0)

`whoami`; `project list`; `project workflow`; `task next | list | get | create | create-bulk | update | move | archive | delete | timeline`; `task comment`, `comment reply` — the current pyramid-cli tree under the new names (`pyramid.task.next`, …). `login` until R1.

## `magic sites …` (R2)

From the engine catalogue (59 tools on 2026-10-16): `check`, `init`, `migrate`, `dev`, `version`; `pull`, `push`, `data pull`; `theme list | pull | push | duplicate | publish | delete | preview | schema | deployments | deploy | restore`; `pages list | get | create | update | publish | unpublish | delete`; `menus list | get | set`; `galleries list | get | set`; `entries …`; `types …`; `designs …`; `site publish | preview | snapshot`. Sites' own `login` and `keys` are not exposed (credentials belong to `magic login`); `mcp` is not a subcommand.

## `magic app …` (R3)

`init | dev | check | version | publish | install | logs | events replay | import` (the App SDK plan's set).

## `magic marketing …` (R4)

`contacts get | list | upsert`; `events track`; `campaigns list`; `flows list`; `lists list`; `segments list`; `reports summary`.

## Never here

Puzzle and framework commands ([[DECISION-NOT-FOR-FRAMEWORKS]]); operator tools (`sites-internal`, `accountctl`, `mspm`) unless [[DOC-OPEN-DECISIONS]] says otherwise.
