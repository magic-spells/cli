---
name: Decision — TypeScript, build to dist, publish dist only
kind: decision
status: built
connections:
  - DATATYPE-MCP-CONFIG
  - DOC-PACKAGE-RENAME
---

# Decision — TypeScript, build to `dist`, publish `dist` only

**Scope:** the *build / publish mechanics*. The package **name, bin, and env var** are defined by
[[DOC-PACKAGE-RENAME]] (one public `@magic-spells/pyramid`, one `pyramid` bin) — this card no
longer names them.

**Decision.**
- **TypeScript, ESM, Node ≥ 22.** `tsc` → `dist/`. `tsx` for dev, `vitest` for tests.
- **Publish the compiled `dist/` only** — `files: ["dist"]`, `bin` → `dist/bin/pyramid.js`,
  `prepublishOnly: "npm run build"`. `npm pack --dry-run` includes `README.md`, `package.json`,
  and compiled `dist/**` files only.
- `publishConfig.access: "public"`.
- Package metadata declares `license: "MIT"`.

**Why.** Type safety on the shared client + operation-registry surface is worth the build step;
`dist`-only keeps the `npx` tarball small. Consistent with `@magic-spells/constellation`.
