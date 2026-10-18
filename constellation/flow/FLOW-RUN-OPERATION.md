---
name: 'Run an operation from the command line: argv → operation → render → exit'
status: planned
triggers:
  - kind: manual
connections:
  - COMPONENT-SHELL
  - COMPONENT-OPERATION-REGISTRY
  - COMPONENT-RENDER
  - DATATYPE-OPERATION
  - DATATYPE-ERROR-ENVELOPE
  - DECISION-OPERATIONS-ARE-THE-CONTRACT
  - DECISION-OPERATION-CONTRACT
  - ROLE-DEVELOPER
---

# Run an operation

Generalises pyramid-cli's FLOW-CLI-INVOKE (pyramid-cli plan).

1. **shell**: parse global flags anywhere in argv; the first remaining token picks a top-level command or a product.
2. **shell**: load the product's registry (lazy; the Sites adapter may spawn its child here — [[FLOW-SITES-ADAPTER-BOOT]]); find the operation by `<noun> <verb>`. No match → usage, nearest names suggested, exit 2.
3. **kit argv**: map positionals and `--flags` to an input object from the zod shape (booleans are presence flags, arrays take repeats or comma lists); `op.input.safeParse`; failure → usage error naming the field, exit 2.
4. **kit**: destructive gate — `meta.destructive` needs `--yes` and `MAGIC_ALLOW_DESTRUCTIVE=1`, else `destructive_action_disabled`, exit 8, nothing changed.
5. **kit**: resolve the session: env key → store item for `--workspace` or the default workspace → `not_logged_in` (exit 3) unless `requiresSession` is false.
6. **product**: `op.run(input, ctx)`; on `auth_expired` the kit re-mints once ([[FLOW-PRODUCT-SESSION-MINT]]).
7. **render**: result to stdout (JSON or human); hints and pagination to stderr; errors as the envelope, exit by class.
8. **shell**: update notice (if due) and telemetry event (if on), after output, then exit.
