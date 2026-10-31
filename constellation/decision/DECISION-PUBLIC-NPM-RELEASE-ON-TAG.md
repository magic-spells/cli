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
notes:
  - kind: decision
    text: >-
      Cory, 2026-10-31: the CLI publishes as the unscoped npm package `magic-spells`; the binary
      stays `magic`, and the workspace packages `@magic-spells/kit` and `@magic-spells/pyramid` keep
      their names. Why: `npx magic-spells login` is what people will guess; the hyphen matches the
      `@magic-spells` scope and the GitHub org; an unscoped front-door CLI beside scoped libraries
      is the usual pattern among the reference CLIs. Rejected: the scoped `cli` package under the
      `@magic-spells` scope (the earlier plan; harder to guess, and that name is no longer used
      anywhere); `magicspells` (only the domain is squashed, so the package name would not match the
      scope and org); `magic` (taken on npm).
  - kind: decision
    text: >-
      2026-10-31, Cory: magic-spells is published to public npm from Cory's machine (`npm run build
      && npm publish -w packages/cli --access public`), then he pushes the matching `v*` tag. The
      tag workflow (release.yml) only verifies: tag matches packages/cli version,
      format/build/typecheck/test/smoke:pack, then installs the published version on three OSes. The
      CI publish step, `id-token: write` and the `NPM_TOKEN` secret are removed. Reason: one publish
      path that matches every other Magic Spells package (Cory publishes by hand), no npm credential
      stored in GitHub. Rejected: CI publish with provenance (needs an npm token in the repo or
      trusted-publisher setup; not worth it for a single publisher).
---

# Public npm, release on tag

## Context

`packages.magicspells.io` (the family's private package host, `mspm`, `org/packages`) serves private SDKs and paid downloads; it is not for a public CLI (research §5.4). Puzzle publishes to npm with `prepack` pin injection and verify-pack scripts (`scripts/release-prep.mjs`, `scripts/inject-platform-pins.mjs`). Cory's rule for every project: agents never create tags and never publish. Every product versions independently today (Puzzle 0.8.0, Pyramid 0.1.1, Marketing 0.1.0 unpublished, Sites release/0.2.0 untagged).

## Decision


- `magic-spells` and its `@magic-spells/sites-engine-<os>-<arch>` packages publish to the public npm registry, `access: public`.
- Cory publishes from his machine (`npm run build && npm publish -w packages/cli --access public`), then pushes the matching `v*` tag. Agents prepare release branches and never tag or publish.
- The tag runs `.github/workflows/release.yml`, which only verifies: the tag matches `packages/cli/package.json`, format/build/typecheck/test/smoke:pack, then installs the published version on three OSes. CI never publishes and holds no npm credential.
- One version for the whole CLI. Product packages are unversioned workspaces (`private: true`). Engine packages carry the CLI's version and the CLI pins them exactly.
- The engine binaries are built from a pinned Sites engine tag recorded in this repo.
- `npx -y magic-spells <command>` is the documented zero-install path; `npm i -g magic-spells` the installed one.

## Alternatives


- **Version each product package separately.** Rejected: a compatibility matrix nobody needs while everything ships from one repo (open row in [[DOC-OPEN-DECISIONS]] records the recommendation).
- **Publish from GitHub Actions with provenance.** Was the first plan; rejected 2026-10-31: it needs an npm automation token stored in the repo (or a trusted-publisher setup), for a package with a single publisher who already publishes every other Magic Spells package by hand.
- **packages.magicspells.io.** Rejected: private channel, wrong audience.

## Consequences


- A Sites engine change reaches users only through a `magic` release.
- No npm credential lives in GitHub; `npm publish` runs under Cory's local npm login ([[EXTERNAL-NPM]]).
- The tag's cross-OS smoke installs the published version, so the tag is pushed after the publish, not before.
