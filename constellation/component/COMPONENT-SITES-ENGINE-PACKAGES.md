---
name: 'Sites engine packages: @magic-spells/sites-engine-<os>-<arch> optional dependencies, pinned to the CLI version'
kind: distribution
status: planned
connections:
  - DECISION-SITES-VIA-BINARY-ADAPTER
  - DECISION-PUBLIC-NPM-RELEASE-ON-TAG
  - COMPONENT-SITES-ADAPTER
  - FEATURE-SITES-ENGINE-PACKAGES
  - FLOW-RELEASE-ON-TAG
  - EXTERNAL-NPM
  - EXTERNAL-SITES
---

# Sites engine packages

Copied from Puzzle's shim: `packages/puzzle/bin/puzzle.js` resolves `@magic-spells/puzzle-<platform>` from optional dependencies, `scripts/inject-platform-pins.mjs` writes exact versions at `prepack`, and verify-pack checks the tarball.

## Shape

- Folders `packages/sites-engine-darwin-arm64`, `-darwin-x64`, `-linux-x64`, `-linux-arm64`, `-win32-x64`, each with `package.json` (`os`, `cpu`, `version` = the CLI's) and `bin/sites[.exe]`, filled by the release workflow, never committed.
- `magic-spells` lists all five as `optionalDependencies`, pinned exactly at pack time.
- A resolver in the adapter: `require.resolve('@magic-spells/sites-engine-${platform}-${arch}/package.json')`, then the binary path; missing → `product_unavailable` naming the platform.
- The binary is built from the Sites engine tag recorded in `engine.lock` (one line: tag + commit) with `GOWORK=off`, as the Sites Makefile already builds it.
