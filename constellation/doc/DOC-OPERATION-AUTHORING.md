---
name: 'Operation authoring: how a product adds a command'
kind: guide
status: planned
connections:
  - DECISION-OPERATIONS-ARE-THE-CONTRACT
  - DECISION-OPERATION-CONTRACT
  - DATATYPE-OPERATION
  - COMPONENT-OPERATION-REGISTRY
  - DOC-COMMAND-TREE
---

# Operation authoring

## Native product (TypeScript)

1. Pick the name `product.noun.verb` ([[DECISION-OPERATION-CONTRACT]]); check `magic <product> --help` for the noun's existing verbs.
2. Write the zod input. Every field gets `.describe()` — it becomes the flag help and the MCP field description. Use enums for closed sets. Put the subject first in `meta.cli.positionals`.
3. Write `run(input, ctx)`: resolve names through the product's resolver, call `ctx.client`, hydrate ids back to names, return a plain object. Lists return `{ items, next_cursor }`. Throw `MagicError` with a code from the envelope; never `console.log`.
4. Mark `meta.destructive: true` for anything that deletes, archives, publishes to the public or overwrites without a version.
5. Add it to the product's `operations` array.
6. Test `run` with a fake client; add a CLI parse test if it has positionals or arrays.
7. Optional: a human renderer for the result.

## Binary-backed product (Sites)

Add the operation to the Go registry (`engine/ops`) with `Surfaces`, `Destructive` and `RequiresSession`; release the engine; bump `engine.lock`. `magic` picks it up from the catalogue with no TypeScript change.

## Checklist

- Works with `--json` and without; output fits a terminal.
- Errors carry a hint that names the next command.
- Appears in `tools/list` with a useful description (agents choose tools by it).
