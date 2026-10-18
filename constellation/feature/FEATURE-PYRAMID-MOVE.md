---
name: 'Pyramid move: pyramid-cli becomes packages/pyramid under magic pyramid …'
status: planned
release: RELEASE-0-SCAFFOLD-AND-BASE
change: breaking
connections:
  - COMPONENT-PYRAMID-PACKAGE
  - DECISION-PYRAMID-CLI-IS-THE-BASE
  - DECISION-OPERATION-CONTRACT
  - FLOW-MOVE-PYRAMID-CLI
  - EXTERNAL-PYRAMID
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
