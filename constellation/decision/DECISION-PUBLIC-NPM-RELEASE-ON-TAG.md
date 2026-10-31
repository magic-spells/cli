---
name: 'Public npm, released on a tag: Cory tags, GitHub Actions publishes one version for the CLI and its engine packages'
status: built
connections:
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
  - DECISION-SITES-VIA-BINARY-ADAPTER
  - FEATURE-RELEASE-PIPELINE
  - FLOW-RELEASE-ON-TAG
  - COMPONENT-UPGRADE
  - COMPONENT-SITES-ENGINE-PACKAGES
  - EXTERNAL-NPM
---

# Public npm, release on tag

## Context

`packages.magicspells.io` (the family's private package host, `mspm`, `org/packages`) serves private SDKs and paid downloads; it is not for a public CLI (research §5.4). Puzzle publishes to npm with `prepack` pin injection and verify-pack scripts (`scripts/release-prep.mjs`, `scripts/inject-platform-pins.mjs`). Cory's rule for every project: agents never create tags and never publish. Every product versions independently today (Puzzle 0.8.0, Pyramid 0.1.1, Marketing 0.1.0 unpublished, Sites release/0.2.0 untagged).

## Decision

- `@magic-spells/cli` and its `@magic-spells/sites-engine-<os>-<arch>` packages publish to the public npm registry, `access: public`, with npm provenance.
- Publishing happens only in GitHub Actions on a `v*` tag that Cory pushes. Agents prepare release branches and never tag or publish.
- One version for the whole CLI. Product packages are unversioned workspaces (`private: true`). Engine packages carry the CLI's version and the CLI pins them exactly.
- The engine binaries are built in the same workflow from a pinned Sites engine tag recorded in this repo.
- `npx -y @magic-spells/cli <command>` is the documented zero-install path; `npm i -g @magic-spells/cli` the installed one.

## Alternatives

- **Version each product package separately.** Rejected: a compatibility matrix nobody needs while everything ships from one repo (open row in [[DOC-OPEN-DECISIONS]] records the recommendation).
- **Publish from a laptop.** Rejected: no provenance, and agents must not publish.
- **packages.magicspells.io.** Rejected: private channel, wrong audience.

## Consequences

- A Sites engine change reaches users only through a `magic` release.
- The release workflow needs an npm automation token in GitHub secrets ([[EXTERNAL-NPM]]).
