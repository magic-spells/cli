---
name: 'npm registry: where magic-spells and the engine packages are published'
kind: saas-vendor
status: planned
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
---

# npm registry

- Scope `@magic-spells`, public access, provenance from GitHub Actions.
- Published: `magic-spells` (unscoped), `@magic-spells/sites-engine-{darwin-arm64,darwin-x64,linux-x64,linux-arm64,win32-x64}`.
- Deprecated: `@magic-spells/pyramid` (0.1.1) after R0.
- `NPM_TOKEN` lives in the repo's GitHub Actions secrets; only Cory creates it.
