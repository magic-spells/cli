---
name: 'Operation contract: product.noun.verb names, one error envelope, exit codes by class, destructive gate, --json shape, cursor pagination'
status: planned
connections:
  - DECISION-OPERATIONS-ARE-THE-CONTRACT
  - DATATYPE-OPERATION
  - DATATYPE-ERROR-ENVELOPE
  - COMPONENT-OPERATION-REGISTRY
  - COMPONENT-RENDER
  - COMPONENT-SITES-ADAPTER
  - DOC-OPERATION-AUTHORING
  - DOC-SECURITY
  - FLOW-RUN-OPERATION
  - FEATURE-KIT-EXTRACTION
notes:
  - kind: gotcha
    text: >-
      Sites' own exit codes are 0 / 1 (theme diagnostics, API 404/422) / 2 (everything else); pyramid-cli uses
      2 for usage errors and 3–10 by class. The adapter maps Sites error codes into the envelope, so `magic sites`
      exits by the table below, not by the child's exit status.
---

# Operation contract

## Context

The Go and TypeScript registries agree in spirit but not in detail (research §5.2): Sites names are dotted `noun.verb` (`theme.push`) and become `theme_push` in MCP; Pyramid names are `verb_noun` snake_case (`list_my_tasks`) with no product prefix. Errors are `ops.Error{Code, Message, Hint}` in Sites (`unknown_operation`, `invalid_input`, `not_available`, `theme_diagnostics`, `failed`, `conflict`, plus API wire codes) and `McpError{code, message, hint?, candidates?}` in pyramid-cli (`src/errors.ts`, codes in `src/types.ts`). pyramid-cli maps codes to exit statuses by class in `src/cli/render.ts` `exitCodeFor`: 3 auth, 4 permission, 5 not found, 6 ambiguous name, 7 validation or conflict, 8 destructive disabled, 9 rate limited, 10 network, 1 unknown; usage errors exit 2. Destructive Pyramid operations need both `--yes` and `PYRAMID_ALLOW_DESTRUCTIVE=1`.

## Decision

1. **Names.** `product.noun.verb`, lower case, dots (`pyramid.task.next`, `sites.pages.list`, `app.version.publish`). CLI: `magic <product> <noun> <verb>`. MCP: dots → `_` (`pyramid_task_next`). Noun is plural where the product's API is (`pages`), matching the product's own words.
2. **Errors.** One envelope, [[DATATYPE-ERROR-ENVELOPE]]: `{ error: { code, message, hint?, candidates?, product } }`. Codes are pyramid-cli's set generalised (`*_not_found` → `not_found` with `details.kind`, `ambiguous_*_name` → `ambiguous_name`), plus Sites' codes mapped (`theme_diagnostics` and `invalid_input` → class 7, `not_available` → class 1 with a hint, `unknown_operation` → usage).
3. **Exit codes by class** (pyramid-cli's table kept): 0 ok, 1 unknown, 2 usage, 3 auth (`auth_invalid`, `auth_expired`, `not_logged_in`), 4 permission, 5 not found, 6 ambiguous, 7 validation/conflict/diagnostics, 8 destructive disabled, 9 rate limited, 10 network, 11 product unavailable (binary missing, version mismatch).
4. **Destructive gate.** An operation flagged `destructive` runs only with `--yes` (CLI) or `yes: true` (MCP input) **and** `MAGIC_ALLOW_DESTRUCTIVE=1` in the environment. Otherwise it fails with `destructive_action_disabled` and changes nothing. The per-product env vars (`PYRAMID_ALLOW_DESTRUCTIVE`) are not read.
5. **Output.** stdout carries data only; diagnostics, progress and prompts go to stderr. `--json` forces JSON; stdout that is not a TTY also gets JSON (pyramid-cli rule). JSON output is the operation's result object unchanged; lists are `{ items, next_cursor }`.
6. **Pagination.** List operations take `limit` and `cursor` and return `next_cursor`; the CLI never auto-paginates (`--all` stays reserved).
7. **Name resolution and hydration.** Where a product supports it, inputs accept names, handles or keys and outputs are hydrated to names. The resolver lives in the product package (Pyramid's `src/cache/resolver.ts`, 60 s workflow cache); the kit provides only the cache primitive.
8. **Workspace.** Every operation that acts in a workspace takes it from `--workspace <handle>` / `workspace` input, else the product session's default.

## Alternatives

- **Keep each product's names and codes.** Rejected: a family MCP needs one naming scheme, and scripts need one exit table.
- **Map exit codes from the child process for Sites.** Rejected: Sites' 0/1/2 loses the class information agents branch on.

## Consequences

- pyramid-cli's operation names and `PYRAMID_ALLOW_DESTRUCTIVE` change when it moves in ([[FEATURE-PYRAMID-MOVE]]).
- The Sites adapter carries a code map from `ops.Error` codes to the envelope ([[COMPONENT-SITES-ADAPTER]]).
- New error codes need a class before they merge; the kit's exhaustive switch enforces it.
