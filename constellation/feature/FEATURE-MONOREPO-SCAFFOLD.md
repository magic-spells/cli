---
name: 'Monorepo scaffold: npm workspaces, Node 24, TypeScript project references, vitest, prettier, CI'
status: built
release: RELEASE-0-SCAFFOLD-AND-BASE
change: chore
connections:
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
  - DECISION-TYPESCRIPT-ON-NODE-24
  - COMPONENT-SHELL
  - COMPONENT-KIT
notes:
  - kind: state
    text: >-
      Built on feat/r0-scaffold (ed50abe, later commits extend it). npm workspaces
      packages/{cli,kit,pyramid}, engines >=24, .nvmrc 24, tsconfig.base.json + project references
      (root `npm run build` = `tsc -b packages/cli`, which builds kit and pyramid first), vitest at
      the root with one project per package (`npm test`), prettier from pyramid-cli (`npm run
      format:check`), MIT LICENSE, README. Workspace imports resolve to TypeScript source in tests
      through vitest aliases, so tests need no prior build. NOT done here, left for
      FEATURE-RELEASE-PIPELINE: ci.yml on three runners. Gap: `npm pack -w packages/cli` holds only
      bin/ + dist/ of the shell; it still depends on the private @magic-spells/kit and
      @magic-spells/pyramid, which are not on npm, so the release pipeline must bundle them into
      packages/cli/dist (e.g. esbuild, third-party deps external) before the first publish. Test
      sources are not type-checked by tsc (pyramid-cli excluded tests too; 24 inherited type errors
      in pyramid tests/operations.test.ts around vi.fn mock.calls).
    sha: ed50abe
---

# Monorepo scaffold

## Scope

- Root `package.json` (`private: true`, `workspaces: ["packages/*"]`, `engines.node >=24`); `.nvmrc` 24 (exists).
- `packages/cli` (published, `bin.magic`), `packages/kit`, `packages/pyramid` (all others `private: true`); later `packages/sites`, `packages/app`, `packages/marketing`, `packages/sites-engine-*`.
- `tsconfig.base.json` + per-package `tsconfig.json` with project references; `tsc -b` builds all.
- vitest at the root; prettier config copied from pyramid-cli.
- GitHub Actions `ci.yml`: Node 24 on ubuntu, macOS and windows; `npm ci`, build, test, format check.
- `LICENSE` (MIT), `README.md` with install and `claude mcp add` lines.

## Acceptance

- `npm ci && npm run build && npm test` passes on all three runners with an empty `magic --version` shell.
- `npm pack -w packages/cli` contains only `dist/` and `package.json`/README/LICENSE.
