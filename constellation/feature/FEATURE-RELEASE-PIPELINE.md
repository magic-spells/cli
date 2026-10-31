---
name: 'Release pipeline: CI on three OSes, publish to npm with provenance on a tag Cory pushes'
status: built
release: RELEASE-0-SCAFFOLD-AND-BASE
change: chore
connections:
  - DECISION-PUBLIC-NPM-RELEASE-ON-TAG
  - FLOW-RELEASE-ON-TAG
  - EXTERNAL-NPM
notes:
  - kind: state
    text: >-
      Built, never run on GitHub (no repo yet) and never published (3b3ca18).
      `.github/workflows/ci.yml`: push to release/** and feat/**, PRs to release/**;
      ubuntu/macos/windows, Node from .nvmrc; npm ci, format:check (ubuntu only, line endings),
      build, typecheck (sources + tests via tsconfig.test.json), test, smoke:pack. `release.yml` on
      `v*`: fails first if the tag is not `v<packages/cli version>`, then ci steps, then `npm
      publish -w packages/cli --access public --provenance` with NODE_AUTH_TOKEN=secrets.NPM_TOKEN
      and id-token: write; a `smoke` job on three OSes runs `npx -y @magic-spells/cli@<version>
      --version/--help` with retries for registry lag. Bundling: packages/cli `prepack` =
      scripts/bundle.mjs — empties dist/, esbuild bundles src/main.ts (ESM, node24, splitting so
      products stay lazy chunks) with every private workspace package aliased to its src/index.ts;
      zod, @modelcontextprotocol/sdk and undici are external and are now cli's only dependencies
      (kit/pyramid deps removed). `files` = bin, dist, !dist/.tsbuildinfo; README + LICENSE in
      packages/cli. package.json `repository` points at github.com/magic-spells/cli (provenance
      needs it to match). Gate: `npm run smoke:pack` packs, installs the tarball into an empty dir
      with only its declared deps (97 packages), and runs --version/--help/pyramid --help: green
      locally. Gotcha: after `npm pack`, packages/cli/dist holds the bundle; the next `npm run
      build` re-emits tsc output (tsbuildinfo was removed with dist). The esbuild postinstall is
      blocked by npm's install-scripts gate locally; the platform binary still works.
    sha: '2952966'
  - kind: state
    text: >-
      Correction to the "no repo yet" note: origin is github.com/magic-spells/cli and PR #1
      (feat/r0-scaffold → release/0.1.0) is open, so ci.yml runs on pushes to the branch.
      release.yml has not run (no tag), and nothing is published. The release job now runs
      format:check too.
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
