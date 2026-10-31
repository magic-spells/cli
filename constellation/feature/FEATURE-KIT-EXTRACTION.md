---
name: 'Kit extraction: pyramid-cli''s generic modules move to packages/kit'
status: built
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
notes:
  - kind: state
    text: >-
      Built in abf9d7d (errors, TTL cache, raw readers) and 5f84173 (operation, config, keychain,
      credentials, argv, cli runner, render, mcp builder, doctor), adopted by Pyramid in 0304bf4.
      packages/kit/src: errors.ts (MagicError, exhaustive exitCodeFor, mapHttpError/toMagicError
      with product-supplied hints and not-found nouns), operation.ts
      (Operation/OpContext/ProductModule, toolName, assertRegistry), config.ts, paths.ts,
      keychain.ts, credentials.ts (MAGIC_<ID>_KEY -> `<id>:manual` -> not_logged_in;
      saveProductKey/forgetProductKey/maskKey ready for `magic login --product-key`), argv.ts,
      cli.ts (runProductCli), context.ts, render.ts, mcp.ts (createMcpServer/callTool), doctor.ts
      (runDoctorChecks), cache.ts, read.ts. Gates: kit tests green, including the exhaustive exit
      table, argv derivation, 0600 file mode, and a lint test that greps kit src for product names
      and product-package imports. Steps landed in two commits rather than eight (Pyramid stayed
      green on its old modules until the switch-over commit).
    sha: 5f84173
  - kind: deviation
    text: >-
      Where the code differs from COMPONENT-KIT: (1) `http` NOT extracted: pyramid-client.ts keeps
      its own undici transport (and its If-Match retry) and only uses the kit's error mapping;
      extract once a second native product needs one. (2) `hydrate` reduced to
      rec/readStr/readField; Pyramid's hydrate.ts keeps its own obj/str helpers. (3) render returns
      exit codes instead of calling process.exit; the shell sets process.exitCode. (4) pyramid-cli's
      hard-coded CLI special cases (--unarchive, --mine, --file) became generic meta.cli fields:
      presets, routes, fileInput. (5) Kit types use `string` for product ids and key prefixes (the
      card's unions would put product names in the kit). (6) Usage errors raised by the shell carry
      product "magic". (7) SIGINT is not wired to OpContext.signal yet (a fresh never-aborted signal
      is passed). (8) update notice and telemetry not started (R4).
    sha: 5f84173
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
