---
name: 'Kit extraction: pyramid-cli''s generic modules move to packages/kit'
status: planned
release: RELEASE-0-SCAFFOLD-AND-BASE
change: feature
connections:
  - COMPONENT-KIT
  - COMPONENT-RENDER
  - COMPONENT-KEYCHAIN
  - COMPONENT-OPERATION-REGISTRY
  - DATATYPE-OPERATION
  - DATATYPE-ERROR-ENVELOPE
  - DATATYPE-CLI-CONFIG
  - DECISION-PYRAMID-CLI-IS-THE-BASE
  - DECISION-OPERATION-CONTRACT
  - FLOW-MOVE-PYRAMID-CLI
---

# Kit extraction

## Scope

Per [[COMPONENT-KIT]]'s table, in this order, each step leaving pyramid tests green ([[FLOW-MOVE-PYRAMID-CLI]] step 3):

1. errors: `McpError` → `MagicError` with `product`; code union and exit table per [[DATATYPE-ERROR-ENVELOPE]]; `mapHttpError`, `toMagicError`.
2. render: `src/cli/render.ts` minus Pyramid task cards (those register as a product renderer).
3. argv: zod → flags/positionals from `src/cli/index.ts`; global flags; `<product> <noun> <verb>` dispatch.
4. config: [[DATATYPE-CLI-CONFIG]] resolution.
5. keychain: [[COMPONENT-KEYCHAIN]] interface; R0 backend = pyramid-cli's `security` path + file, service `io.magicspells.cli`.
6. mcp builder: `src/mcp/server.ts` generalised to many products.
7. cache: TTL primitive.
8. doctor runner: checks contributed per product.

## Acceptance

- `packages/kit` has no import of any product package and no product name in source (a lint test greps for it).
- Unit tests cover argv derivation (positionals, booleans, arrays, enums), the exit table (exhaustive), and the file fallback's 0600 mode.
