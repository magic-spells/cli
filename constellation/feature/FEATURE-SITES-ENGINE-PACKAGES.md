---
name: 'Sites engine packages: per-platform @magic-spells/sites-engine-* builds, pins and resolver'
status: planned
release: RELEASE-2-SITES
change: feature
connections:
  - COMPONENT-SITES-ENGINE-PACKAGES
  - DECISION-SITES-VIA-BINARY-ADAPTER
  - DECISION-PUBLIC-NPM-RELEASE-ON-TAG
  - FLOW-RELEASE-ON-TAG
  - EXTERNAL-NPM
---

# Sites engine packages

## Scope

- Five platform package folders and their `package.json` templates; `engine.lock` naming the Sites engine tag.
- Copy Puzzle's `inject-platform-pins.mjs` and verify-pack into `scripts/`; adapt names.
- Release workflow job: cross-compile from the locked tag, fill the folders, publish before the CLI ([[FLOW-RELEASE-ON-TAG]] steps 4–6).
- Local dev: `MAGIC_SITES_ENGINE=/path/to/sites` bypasses the packages.

## Acceptance

- A dry-run release on a branch produces five tarballs each holding one executable `sites` binary that prints the locked version.
- Installing `@magic-spells/cli` on each CI OS installs exactly one engine package.
