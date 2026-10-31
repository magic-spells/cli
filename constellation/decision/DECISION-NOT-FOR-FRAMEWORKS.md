---
name: 'Not for the frameworks: Puzzle, puzzle-pieces and Open Sourcery keep their own CLIs'
status: planned
connections:
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
  - DOC-COMMAND-TREE
  - COMPONENT-UPGRADE
  - COMPONENT-SITES-ENGINE-PACKAGES
---

# Not for the frameworks

## Context

Cory, 2026-10-18 (verbatim):

- "puzzle is its own project and dev workflow, magic CLI is for magic spells services and products, not open source frameworks"
- "I think it's better to have one CLI that does everything than have 4 CLIs for each project."

The second quote could read as "everything goes in `magic`". The first draws the line: "everything" means the hosted services. The open-source frameworks have their own audiences, release cadences and dev loops: `puzzle` (Go via an npm shim, `@magic-spells/puzzle` 0.8.0, `build | dev | preview | init | add | check | doctor | generate | info | upgrade`), `puzzle add piece` reading the puzzle-pieces registry, and the Open Sourcery web components, which have no CLI at all (research §1).

## Decision

- `magic` carries only commands for hosted Magic Spells services and products: Sites, Pyramid, Marketing, the Sites App SDK, Account, and later hosted products (Reviews, Wishlist).
- Puzzle, puzzle-pieces and the Open Sourcery components are never namespaces in `magic` (`magic puzzle …` does not exist) and never depend on `magic-spells`.
- `magic` may **copy** patterns from Puzzle's CLI (the platform-binary shim, the cached update notice and `upgrade`) but does not import its code.
- A command that touches both (for example a Sites theme built with Puzzle components) belongs to the hosted product: `magic sites dev` runs the Sites engine; it does not wrap `puzzle dev`.

## Alternatives

- **Fold `puzzle` in as `magic puzzle …`.** Rejected by Cory: framework users who never touch a hosted service would install a CLI that asks them to log in, and the framework's release cadence would be tied to the services'.
- **Make `magic` a launcher that also finds `puzzle` on PATH.** Rejected: no gain over typing `puzzle`.

## Consequences

- [[DOC-COMMAND-TREE]] lists no framework commands; `magic doctor` does not check Puzzle.
- The Puzzle update pattern (DECISION-D76-CLI-UPGRADE, puzzle plan) is copied into [[COMPONENT-UPGRADE]] rather than shared.
- Operator tools (`sites-internal`, `accountctl`, `mspm`) are a separate question, recorded open in [[DOC-OPEN-DECISIONS]] (recommendation: keep them out).
