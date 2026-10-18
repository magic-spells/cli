---
name: 'Error envelope: { error: { code, message, hint?, candidates?, product, details? } } and the code → exit class table'
status: planned
connections:
  - DECISION-OPERATION-CONTRACT
  - COMPONENT-RENDER
  - COMPONENT-KIT
  - COMPONENT-MCP-AGGREGATOR
  - COMPONENT-SITES-ADAPTER
---

From pyramid-cli's `McpError.toJSON()` (`src/errors.ts`) with the product added and the not-found and ambiguous families collapsed. Printed to stderr by the CLI under `--json` and returned as the text of an `isError` MCP result.

```ts
type MagicErrorCode =
  | 'usage'                         // exit 2
  | 'not_logged_in' | 'auth_invalid' | 'auth_expired'   // 3
  | 'permission_denied'             // 4
  | 'not_found'                     // 5   details.kind: 'project' | 'task' | 'page' | …
  | 'ambiguous_name'                // 6   candidates[]
  | 'validation_failed' | 'conflict' | 'diagnostics'    // 7
  | 'destructive_action_disabled'   // 8
  | 'rate_limited'                  // 9
  | 'network'                       // 10
  | 'product_unavailable'           // 11  engine missing, version mismatch, product down
  | 'unknown';                      // 1

interface ErrorEnvelope {
  error: {
    code: MagicErrorCode;
    message: string;              // for people; callers act on code, never parse this
    hint?: string;                // the next thing to do ("run magic login")
    candidates?: string[];        // ambiguous_name / not_found close matches
    product: 'magic' | 'pyramid' | 'sites' | 'app' | 'marketing';
    details?: Record<string, unknown>;   // field, kind, diagnostics[] for Sites theme checks
  };
}
```

HTTP mapping stays pyramid-cli's `mapHttpError`: 401 → `auth_invalid` (or `auth_expired`), 403 → `permission_denied`, 404 → `not_found`, 400/422 → `validation_failed` (with `details.field`), 409 → `conflict`, 429 → `rate_limited`, 5xx → `unknown`; network failures → `network`.
