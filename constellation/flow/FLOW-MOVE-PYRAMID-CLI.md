---
name: 'Move pyramid-cli into packages/pyramid and split out the kit'
status: planned
triggers:
  - kind: manual
connections:
  - DECISION-PYRAMID-CLI-IS-THE-BASE
  - FEATURE-PYRAMID-MOVE
  - FEATURE-KIT-EXTRACTION
  - FEATURE-DEPRECATE-PYRAMID-CLI
  - COMPONENT-PYRAMID-PACKAGE
  - COMPONENT-KIT
---

# Move pyramid-cli

1. **this repo**: on the R0 feature branch, import `magic-spells/pyramid-cli` history into `packages/pyramid/` (subtree merge), excluding `dist/`, `node_modules/` and its `constellation/` (the plan stays in the archived repo).
2. **this repo**: make it build and pass its tests unchanged inside the workspace (`engines >=24`, TypeScript and vitest from the root).
3. **this repo**: move generic modules to `packages/kit` one at a time, each step green: errors → render → argv → config → keychain → mcp builder → cache primitive → doctor runner ([[FEATURE-KIT-EXTRACTION]]).
4. **this repo**: rename operations to `pyramid.<noun>.<verb>`; env vars to `MAGIC_*`; keychain service to `io.magicspells.cli`.
5. **this repo**: wire `packages/pyramid` into the shell; `magic pyramid …` and `pyramid_*` tools pass the R0 gate.
6. **Cory**: after R0 publishes, `npm deprecate @magic-spells/pyramid "Moved to magic-spells — run: npx magic-spells pyramid …"` and archive `magic-spells/pyramid-cli` with a README pointer ([[FEATURE-DEPRECATE-PYRAMID-CLI]]).
