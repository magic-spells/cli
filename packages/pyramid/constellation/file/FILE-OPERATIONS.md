---
name: src/operations/index.ts
status: built
path: src/operations/index.ts
language: typescript
summary: Surface-agnostic operation registry — the single source the MCP tools and the CLI both render from.
connections:
  - FILE-PYRAMID-CLIENT
  - FILE-RESOLVER
  - FILE-SERVER
  - FILE-CLI
  - DOC-DESIGN-RULES
  - API-TOOL-CREATE-TASK
---

The seam that keeps the two surfaces DRY. Each **operation** is one entry:

```ts
interface Operation<I, O> {
  name: string;                              // e.g. "create_task" — MCP tool name
  summary: string;
  input: ZodObject<ZodRawShape>;             // SDK emits JSON Schema (MCP); CLI derives flags/args
  run(input: I, ctx: OpContext): Promise<O>; // resolve names → client call → hydrate
  meta?: { cli?: { group: string; verb: string; positionals?: string[] }; destructive?: boolean };
}
```

`run` is where the Pyramid logic lives — name resolution ([[FILE-RESOLVER]]), the
[[FILE-PYRAMID-CLIENT]] call, response hydration, and the design invariants
([[DOC-DESIGN-RULES]]). The MCP layer ([[FILE-SERVER]]) maps each operation to
`server.tool(name, input, run)`; the CLI layer ([[FILE-CLI]]) maps the same entry to a
subcommand + arg parser. The `API-TOOL-*` cards (e.g. [[API-TOOL-CREATE-TASK]]) **are** these
operations — one registry, two renderings.

Built operation surface:

- Discovery: `whoami`, `list_projects`, `get_project_workflow`, `list_my_tasks`.
- Tasks: `list_tasks`, `get_task`, `search_tasks`, `create_task`, `create_tasks_bulk`,
  `update_task`, `move_task`, `archive_task`, `delete_task`.
- Comments: `list_comments`, `add_comment`, `reply_to_comment`.

`delete_task` is marked destructive in `meta` and is gated by `PYRAMID_ALLOW_DESTRUCTIVE=1`.
The planned `set_task_status`, bulk-update, references, and workflow-admin cards remain future
operations, not entries in the shipped registry.
