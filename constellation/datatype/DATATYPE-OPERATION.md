---
name: 'Operation: name, summary, zod input, run, meta (cli shape, destructive, surfaces)'
status: planned
connections:
  - DECISION-OPERATIONS-ARE-THE-CONTRACT
  - DECISION-OPERATION-CONTRACT
  - COMPONENT-OPERATION-REGISTRY
  - COMPONENT-KIT
  - DOC-OPERATION-AUTHORING
---

pyramid-cli's `Operation` (`src/operations/index.ts`) generalised. Sites' Go `ops.Operation` (`Name`, `Summary`, `Detail`, `Surfaces`, `Input`, `Run`) maps onto the same fields in the adapter.

```ts
import type { z } from 'zod';

interface OpContext {
  config: CliConfig;              // DATATYPE-CLI-CONFIG
  session: ProductSession | null; // DATATYPE-PRODUCT-SESSION, null when not logged in
  client: unknown;                // the product's client, built by ProductModule.client
  cache: TtlCache;                // kit cache primitive; resolvers live in the product
  signal: AbortSignal;            // cancelled on SIGINT
}

interface Operation<I = unknown, O = unknown> {
  name: `${string}.${string}.${string}`;  // product.noun.verb
  summary: string;                        // one line: CLI help + MCP description
  detail?: string;                        // long help; MCP description appendix
  input: z.ZodObject<z.ZodRawShape>;      // flags and MCP input schema derive from this
  run(input: I, ctx: OpContext): Promise<O>;
  meta?: {
    destructive?: boolean;                // needs --yes / yes:true AND MAGIC_ALLOW_DESTRUCTIVE=1
    surfaces?: ('cli' | 'mcp')[];         // default both (Sites' Surfaces)
    cli?: {
      positionals?: string[];             // input keys taken positionally, in order
      aliases?: Record<string, string>;   // flag alias → input key
      verbAliases?: string[];             // e.g. "ls" for "list"
    };
    requiresSession?: boolean;            // default true; false for local-only ops (check)
  };
}
```

Changes from pyramid-cli: `name` carries the product and replaces `meta.cli.group/verb` and `meta.mcpTool` (both derived); `surfaces` and `requiresSession` are new; `OpContext.resolver` moves inside the product's client.
