---
name: 'Pyramid move: pyramid-cli becomes packages/pyramid under magic pyramid …'
status: built
release: RELEASE-0-SCAFFOLD-AND-BASE
change: breaking
connections:
  - COMPONENT-PYRAMID-PACKAGE
  - DECISION-PYRAMID-CLI-IS-THE-BASE
  - DECISION-OPERATION-CONTRACT
  - FLOW-MOVE-PYRAMID-CLI
  - EXTERNAL-PYRAMID
notes:
  - kind: state
    text: >-
      Built. History carried with `git subtree add --prefix=packages/pyramid <pyramid-cli>
      release/0.1.0` (f66fb46 merges pyramid-cli 91bd986, all 24 commits reachable), then 3e4b2a2
      dropped the imported constellation/, lockfile, configs and CLAUDE.md and ran the suite
      unchanged (169 pass / 2 skip, same as pyramid-cli). 0304bf4 moved Pyramid onto the kit: 17
      operations (the brief said 16; search_tasks and list_comments were added in pyramid-cli since
      the count) renamed pyramid.<noun>.<verb>, MCP tools pyramid_*, env vars MAGIC_PYRAMID_KEY /
      MAGIC_PYRAMID_URL / MAGIC_ALLOW_DESTRUCTIVE / MAGIC_PYRAMID_WEB_URL, keys stored as
      `pyramid:manual` under io.magicspells.cli. `magic pyramid task next|update|comment`, `project
      list`, `whoami` keep pyramid-cli's shape; `magic pyramid login` kept until R1. Gates: tests
      drive task next, task list --mine, whoami, project list and the destructive gate end to end
      against a fake API on 127.0.0.1; NOT yet run against production with a real pyk_ key.
    sha: 0304bf4
  - kind: deviation
    text: >-
      Name map: whoami -> pyramid.whoami (two-part name, CLI `magic pyramid whoami`); list_projects
      -> pyramid.project.list; get_project_workflow -> pyramid.project.workflow; list_my_tasks ->
      pyramid.task.list-mine (verb alias `next`, MCP pyramid_task_list_mine); list_tasks ->
      pyramid.task.list (`--mine` routes to list-mine); get_task -> pyramid.task.get (alias `show`);
      get_task_timeline -> pyramid.task.timeline; search_tasks -> pyramid.task.search; create_task
      -> pyramid.task.create; create_tasks_bulk -> pyramid.task.create-bulk (alias `bulk`,
      `--file`); update_task -> pyramid.task.update; move_task -> pyramid.task.move; archive_task ->
      pyramid.task.archive (`archived` now defaults to true, `--unarchive` sets false); delete_task
      -> pyramid.task.delete; add_comment -> pyramid.task.comment; reply_to_comment ->
      pyramid.comment.reply; list_comments -> pyramid.comment.list. Behaviour changes: error codes
      collapse per DATATYPE-ERROR-ENVELOPE (ambiguous status/stage now ambiguous_name exit 6, was
      validation_failed exit 7; status_not_in_stage / invalid_field_value / reply_depth_exceeded /
      task_archived become validation_failed with details.reason; an unrecognised 404 is not_found,
      was unknown); `--base-url` dropped in favour of MAGIC_PYRAMID_URL; MCP resource names and the
      doctor prompt are prefixed pyramid_ and the prompt names pyramid_whoami; destructive MCP tools
      take `yes`. set-key/show-key/logout were removed from the package; their replacements (`magic
      login --product-key`, `magic whoami`, `magic logout --product pyramid`) are
      FEATURE-WHOAMI-DOCTOR's.
    sha: 0304bf4
  - kind: deviation
    text: >-
      Behaviour changes from pyramid-cli that had no note (from the part-1 review): (1) the human
      error line is `error [code]: message` with no noun prefix; (2) usage errors print the JSON
      envelope on stderr when stderr's sibling stdout is not a TTY, like every other error (and now
      top-level `magic bogus` does too); (3) the pagination hint reads `more: --cursor X`; (4) a
      malformed MAGIC_PYRAMID_URL is a usage error, exit 2 (pyramid-cli exited 1); (5) usage
      messages name the canonical verb (`task list-mine`), not the alias typed (`next`); (6) `magic
      pyramid login --help` now prints usage and exits 0 (it was exit 2 "unknown option"); (7)
      `--workspace` on a command with no workspace input is a usage error, exit 2, not silently
      ignored. Pyramid's MCP instructions now carry the CLI's version (pyramid/src/version.ts
      deleted; ProductMcp.instructions is a function of the version).
---

# Pyramid move

## Scope

- History-preserving import of pyramid-cli into `packages/pyramid` ([[FLOW-MOVE-PYRAMID-CLI]]).
- Operations renamed to `pyramid.<noun>.<verb>`; MCP tools become `pyramid_*`; INSTRUCTIONS, resources and prompts carried verbatim with the new tool names.
- `PYRAMID_API_KEY` → `MAGIC_PYRAMID_KEY`, `PYRAMID_BASE_URL` → `MAGIC_PYRAMID_URL`, `PYRAMID_ALLOW_DESTRUCTIVE` → `MAGIC_ALLOW_DESTRUCTIVE`.
- `set-key`/`show-key`/`logout` folded into `magic login --product-key`, `magic whoami`, `magic logout --product pyramid`.
- `pyramid login` (loopback to Pyramid web `/auth/cli`, mints a workspace `pyk_`) kept as `magic pyramid login` until R1, then removed.
- `--project` stays a Pyramid flag.

## Acceptance

- pyramid-cli's vitest suite passes inside the workspace with names updated.
- `magic pyramid task next`, `task update`, `task comment` behave as `pyramid task …` did, against the production API with a `pyk_` key.
- `magic pyramid whoami` prints user, workspace and projects.
