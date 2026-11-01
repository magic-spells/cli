---
name: Update notice and magic update
status: planned
triggers:
  - kind: manual
connections:
  - COMPONENT-UPGRADE
  - FEATURE-UPGRADE
  - EXTERNAL-NPM
notes:
  - kind: deviation
    text: >-
      2026-10-31 (feat/upgrade, release/0.3.0): as built the command is `magic update` (no alias).
      The cache is config.json `updateCheck: {checkedAt, latest}`, not ~/.cache/magic/update.json;
      the refresh is an unref'd in-process request (2 s, daily) started alongside the command, not a
      detached process; the notice reads "A newer magic is available: X (you have Y). Run `magic
      update`."; only global npm is driven (no pnpm/bun) and npx says there is nothing to update.
      COMPONENT-UPGRADE has the built shape.
---

# Update notice and upgrade

1. **shell, after any command**: skip if `CI`, `MAGIC_NO_UPDATE_CHECK`, `--json`, `--quiet`, `magic mcp`, or stderr is not a TTY.
2. **shell**: read `~/.cache/magic/update.json`. If `latest` > the running version, print one stderr line: "magic <latest> is available — run magic upgrade".
3. **shell**: if `checked_at` is older than an hour, spawn a detached `magic __update-check` that fetches the npm dist-tag `latest` and rewrites the cache; the parent does not wait.
4. **person**: `magic upgrade`.
5. **upgrade**: detect the install (global npm/pnpm/bun prefix of the running file, or an `npx` cache path); for `npx`, print "you are running through npx; use npx -y magic-spells@latest" and exit 0.
6. **upgrade**: run the manager's global install of `magic-spells@latest` with output streamed; exit with its status. The engine packages follow because they are pinned optional dependencies.
