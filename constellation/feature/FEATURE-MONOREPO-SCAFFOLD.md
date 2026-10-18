---
name: 'Monorepo scaffold: npm workspaces, Node 24, TypeScript project references, vitest, prettier, CI'
status: planned
release: RELEASE-0-SCAFFOLD-AND-BASE
change: chore
connections:
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
  - DECISION-TYPESCRIPT-ON-NODE-24
  - COMPONENT-SHELL
  - COMPONENT-KIT
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
