---
name: 'Release pipeline: CI on three OSes, publish to npm with provenance on a tag Cory pushes'
status: planned
release: RELEASE-0-SCAFFOLD-AND-BASE
change: chore
connections:
  - DECISION-PUBLIC-NPM-RELEASE-ON-TAG
  - FLOW-RELEASE-ON-TAG
  - EXTERNAL-NPM
---

# Release pipeline

## Scope

- `release.yml` on `v*` tags per [[FLOW-RELEASE-ON-TAG]] (engine steps arrive in R2).
- `NPM_TOKEN` secret (Cory creates); `id-token: write` for provenance.
- A smoke job that installs the just-published version on each OS.
- Release-branch workflow documented in `CLAUDE.md` (exists).

## Acceptance

- A `v0.1.0` tag publishes `@magic-spells/cli@0.1.0` with a provenance badge, and the smoke job passes.
- A tag that does not match `packages/cli/package.json` fails before publishing.
