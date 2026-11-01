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

# Update notice and magic update

1. **shell, around any command**: skip if `CI`, `MAGIC_NO_UPDATE_CHECK`, `update`, `mcp`, `--version`, `--help`, `--json`, `--quiet`, or stdout or stderr is not a TTY.
2. **shell, before the command**: read `updateCheck: { checkedAt, latest }` from config.json. If `checkedAt` is a day old (or missing), start one request for the npm registry's `magic-spells/latest` (2 s timeout, unref'd so it never holds the process open, failures silent) that writes the cache when it answers.
3. **shell, after the command**: if the cached `latest` > the running version, print one stderr line: "A newer magic is available: <latest> (you have <current>). Run `magic update`."
4. **person**: `magic update` (`--check` / `--json` only report `{current, latest, upToDate, method}`).
5. **update**: look up the latest version (5 s); a failure is the `network` envelope. Up to date: say so, exit 0.
6. **update**: detect the install from the running file's realpath: a global npm root (`/lib/node_modules/`, or on Windows %AppData%\npm, nodejs, nvm-windows, Volta) runs `npm install -g magic-spells@<latest>` with output streamed; an `_npx` cache path says npx already fetches the latest; anything else prints where it runs from and the install command. Only a version matching the semver pattern ever reaches npm.
