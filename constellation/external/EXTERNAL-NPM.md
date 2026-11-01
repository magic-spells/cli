---
name: 'npm registry: where magic-spells and the engine packages are published'
kind: saas-vendor
status: built
vendor: npm
purpose: 'Public distribution of the CLI and its per-platform Sites engine packages; update checks read dist-tags'
docs_url: https://docs.npmjs.com/cli/commands/npm-publish
credentials_envs:
  - NPM_TOKEN
connections:
  - DECISION-PUBLIC-NPM-RELEASE-ON-TAG
  - FEATURE-RELEASE-PIPELINE
  - FEATURE-SITES-ENGINE-PACKAGES
  - FEATURE-DEPRECATE-PYRAMID-CLI
  - COMPONENT-UPGRADE
  - COMPONENT-SITES-ENGINE-PACKAGES
  - FLOW-RELEASE-ON-TAG
  - FLOW-UPGRADE
notes:
  - kind: state
    text: >-
      2026-10-31: in use — `magic-spells` 0.1.0, 0.2.0 and 0.2.1 are published (all tagged).
      Corrections to the body: Cory publishes from his own machine (the tag workflow only verifies,
      c60ac61), so no NPM_TOKEN secret or Actions provenance is in play today; the sites-engine
      packages are not published yet (R2); `@magic-spells/pyramid` is not deprecated yet
      (FEATURE-DEPRECATE-PYRAMID-CLI).
---

# npm registry

- Scope `@magic-spells`, public access, provenance from GitHub Actions.
- Published: `magic-spells` (unscoped), `@magic-spells/sites-engine-{darwin-arm64,darwin-x64,linux-x64,linux-arm64,win32-x64}`.
- Deprecated: `@magic-spells/pyramid` (0.1.1) after R0.
- `NPM_TOKEN` lives in the repo's GitHub Actions secrets; only Cory creates it.
