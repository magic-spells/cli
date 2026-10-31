---
name: 'Operation registry: the per-product list of operations, and the shell''s merged view across products'
kind: library
status: planned
framework: typescript
connections:
  - DATATYPE-OPERATION
  - DECISION-OPERATIONS-ARE-THE-CONTRACT
  - DECISION-OPERATION-CONTRACT
  - COMPONENT-PYRAMID-PACKAGE
  - COMPONENT-SITES-ADAPTER
  - COMPONENT-APP-PACKAGE
  - COMPONENT-MARKETING-PACKAGE
  - DOC-OPERATION-AUTHORING
  - FLOW-RUN-OPERATION
  - FLOW-MCP-TOOL-CALL
notes:
  - kind: deviation
    text: >-
      ProductModule as built (packages/kit/src/operation.ts): `id`, `title`, `credential` are
      strings (no product unions in the kit); added `apiUrl` (default base URL, overridden by
      MAGIC_<ID>_URL or the config file), `keyHelp` (for not_logged_in hints), `globalFlags` (value
      flags read anywhere in argv and used as input defaults; Pyramid's `--project`), and `commands`
      (non-operation product commands such as `magic pyramid login`). `mcp.register(server, ctx)`
      replaces resources/prompts arrays. Uniqueness is checked by assertRegistry at load and in each
      product's registry test. The shell's cross-product merged map is not built yet: `magic mcp`
      aggregation is FEATURE-MCP-AGGREGATOR's.
    sha: 5f84173
  - kind: state
    text: >-
      R1: `magic pyramid login` is gone, so no product uses `commands` today; the hook stays in
      ProductModule for later non-operation product commands. ProductModule also gained `sessions: {
      path }` (FLOW-PRODUCT-SESSION-MINT).
    sha: 9a25cf7
---

# Operation registry

Each product package default-exports a `ProductModule`:

```ts
interface ProductModule {
  id: 'pyramid' | 'sites' | 'app' | 'marketing';
  title: string;                          // "Pyramid"
  credential: 'pyramid_' | 'pk_' | 'pmk_' | 'ak_';
  load(ctx: KitContext): Promise<Operation[]>;   // binary-backed products build the list here
  client(session: ProductSession, cfg: CliConfig): unknown;
  doctor?: DoctorCheck[];
  mcp?: { instructions?: string; resources?: unknown[]; prompts?: unknown[] };
}
```

The shell keeps one map `name → { product, operation }` built lazily per product. Lookups: CLI by `<product> <noun> <verb>` (aliases from `meta.cli.aliases`), MCP by tool name.

## Rules

- A name is unique across the whole map; a duplicate fails the build test, not the run.
- `load` is the only async step. Native products return a static array; the Sites adapter spawns its child there ([[FLOW-SITES-ADAPTER-BOOT]]).
- An operation's `run` receives `OpContext { config, session, client, cache, signal }` and returns a plain object; it never prints.
