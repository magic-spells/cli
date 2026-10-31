---
name: McpError
status: built
connections:
  - DOC-ERROR-MODEL
---

The single error shape returned to the AI for every failure ([[DOC-ERROR-MODEL]]). Act on
`code`; don't parse `message`.

```ts
type McpError = {
  code:
    | "auth_invalid" | "auth_expired"
    | "project_not_found" | "ambiguous_project_name"
    | "task_not_found" | "task_archived"
    | "status_not_found" | "stage_not_found" | "status_not_in_stage"
    | "user_not_found" | "ambiguous_user_name"
    | "label_not_found" | "ambiguous_label_name"
    | "field_not_found" | "invalid_field_value"
    | "reply_depth_exceeded"
    | "permission_denied" | "validation_failed" | "conflict" | "rate_limited"
    | "destructive_action_disabled" | "network" | "unknown";
  message: string;       // human-readable
  hint?: string;         // recovery tip, e.g. "regenerate your key"
  candidates?: string[]; // for ambiguous_* / near-miss *_not_found
};
```
