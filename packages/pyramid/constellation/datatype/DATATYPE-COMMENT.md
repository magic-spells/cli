---
name: TaskComment
status: built
connections:
  - DOC-DESIGN-RULES
---

A comment, stage-scoped, with 1-level replies. **The MCP hydrates it** — the server returns
`author_id`, `stage_id`, and `mentions` as bare UUIDs plus `content` + `content_html`; the MCP joins
names via the cached members list and re-renders `@mentions` ([[DOC-RENDERING]]).

```ts
interface TaskComment {
  id: string;
  task_id: string;
  stage: { id: string; name: string };          // hydrated from stage_id
  author: { id: string; display_name: string };  // hydrated from author_id
  content: string;                                // markdown; content_html stripped, @mentions re-rendered
  mentions: { id: string; display_name: string }[];
  replies: Array<Omit<TaskComment, "replies">>;   // 1-level only (reply-to-reply rejected)
  created_at: string;
}
```

**Reactions are write-only** — there is no API to LIST reactions on a comment, so they are not on this
shape (don't promise reaction counts). The comment list is `{ data, cursor }`, oldest-first.
