---
name: 'Upgrade: cached update notice and magic update'
kind: library
status: built
framework: typescript
connections:
  - DECISION-PUBLIC-NPM-RELEASE-ON-TAG
  - DECISION-NOT-FOR-FRAMEWORKS
  - FEATURE-UPGRADE
  - FLOW-UPGRADE
  - EXTERNAL-NPM
notes:
  - kind: state
    text: >-
      2026-10-31: built on feat/upgrade (release/0.3.0). The command is `magic update` only, with no
      alias (Cory: "most apps call it an update"; the other word is reserved for account plan
      upgrades). Only npm global installs are driven (pnpm/bun not detected); the cache lives in
      config.json `updateCheck`, not a separate cache file, and refreshes daily, not hourly. Tests:
      packages/cli/tests/update.test.ts against a fake registry.
---

# Upgrade

Adapted from Puzzle's DECISION-D76-CLI-UPGRADE (puzzle plan): a passive notice printed from a cache, refreshed at most daily; gated by `CI`, `MAGIC_NO_UPDATE_CHECK` and non-TTY output; `magic update` drives npm.

- Lookup: `GET https://registry.npmjs.org/magic-spells/latest`, JSON `version`. The answer is untrusted: only versions matching `^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$` are ever used or handed to npm.
- Cache: `config.json` `updateCheck: { checkedAt, latest }` (the other keys of the file are kept). At most one registry request per 24 h, started alongside the command with a 2 s timeout and an unref'd socket, failures silent; the next run shows its result.
- Notice: one stderr line after the command finishes, "A newer magic is available: X (you have Y). Run `magic update`." Never under `update`, `mcp`, `--version`, `--help`, `--json`, `--quiet`, or when stdout or stderr is not a terminal.
- `magic update`: global npm install (realpath under `/lib/node_modules/magic-spells/` or `\node_modules\magic-spells\`) runs `npm install -g magic-spells@<latest>`; an `_npx` cache path says npx already fetches the latest; anything else prints where the binary runs from and the install command. `--check` and `--json` only report `{current, latest, upToDate, method}`. A registry failure is the `network` envelope (exit 10).

Code: packages/kit/src/update.ts (registry, compare, install method, cache), packages/cli/src/commands/update.ts (the command and the notice gate).
