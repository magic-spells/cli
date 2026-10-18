---
name: 'Deprecate @magic-spells/pyramid and archive magic-spells/pyramid-cli'
status: planned
release: RELEASE-0-SCAFFOLD-AND-BASE
change: chore
connections:
  - DECISION-PYRAMID-CLI-IS-THE-BASE
  - FLOW-MOVE-PYRAMID-CLI
  - EXTERNAL-PYRAMID
  - EXTERNAL-NPM
---

# Deprecate the Pyramid CLI

**Lands in:** pyramid (`pyramid/pyramid-cli` README and plan, then the GitHub archive) · npm (Cory runs `npm deprecate`)

## Scope

- Final pyramid-cli commit: README pointing to `@magic-spells/cli` and the command mapping (`pyramid task next` → `magic pyramid task next`, `pyramid mcp` → `magic mcp --products pyramid`), plan.md current state "archived, moved to magic-spells/cli".
- Pyramid's web `/auth/cli` page (used by `pyramid login`) stays until R1 removes `magic pyramid login`, then can go.
- Cory: `npm deprecate @magic-spells/pyramid "<message>"` and GitHub archive. No migration period (Cory 2026-10-18).

## Acceptance

- `npm view @magic-spells/pyramid deprecated` returns the message; the repo shows as archived.
