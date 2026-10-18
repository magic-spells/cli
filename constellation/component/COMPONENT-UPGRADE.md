---
name: 'Upgrade: cached update notice and magic upgrade (Puzzle''s D76 pattern)'
kind: library
status: planned
framework: typescript
connections:
  - DECISION-PUBLIC-NPM-RELEASE-ON-TAG
  - DECISION-NOT-FOR-FRAMEWORKS
  - FEATURE-UPGRADE
  - FLOW-UPGRADE
  - EXTERNAL-NPM
---

# Upgrade

Copied, not imported, from Puzzle's DECISION-D76-CLI-UPGRADE (puzzle plan): a passive notice printed from a cache; a detached process refreshes the cache at most hourly; gated by `CI`, a `MAGIC_NO_UPDATE_CHECK` env var and non-TTY output; `upgrade` drives the person's own package manager.

- Cache: `~/.cache/magic/update.json` `{ checked_at, latest }` from the npm registry's dist-tags.
- Notice: one stderr line after a command finishes, never under `--json`, `--quiet`, `magic mcp` or a non-TTY stderr.
- `magic upgrade`: detects how `magic` was installed (global npm, pnpm, bun, or `npx` — for `npx` it prints the `-y @latest` form instead) and runs that manager's global install of `@magic-spells/cli@latest`.
