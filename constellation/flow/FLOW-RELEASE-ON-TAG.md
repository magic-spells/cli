---
name: 'Release: Cory tags, GitHub Actions builds engines and publishes'
status: planned
triggers:
  - kind: manual
connections:
  - DECISION-PUBLIC-NPM-RELEASE-ON-TAG
  - FEATURE-RELEASE-PIPELINE
  - COMPONENT-SITES-ENGINE-PACKAGES
  - EXTERNAL-NPM
---

# Release on tag

1. **agents**: work lands on `release/x.y.z`; the version in `packages/cli/package.json` is set there. Agents never tag or publish.
2. **Cory**: merges to `main` at launch time and pushes tag `vX.Y.Z`.
3. **CI (`release.yml`)**: checks the tag equals the package version; installs, type-checks and tests on Node 24.
4. **CI**: from R2, checks out the Sites engine at the tag in `engine.lock`, cross-compiles `sites` for darwin-arm64, darwin-x64, linux-x64, linux-arm64, win32-x64 with `GOWORK=off`, and places each binary in its `packages/sites-engine-*` folder with `version` = the CLI's.
5. **CI**: `prepack` injects exact optional-dependency pins; verify-pack checks each tarball's file list.
6. **CI**: `npm publish --provenance --access public` for each engine package, then `magic-spells`.
7. **CI**: smoke test from the registry: `npx -y magic-spells@X.Y.Z --version` and `doctor --json` on each OS runner.

- A failure after some engine packages published leaves those versions orphaned; the CLI was not published, so nothing references them. Re-run with a new patch tag.
