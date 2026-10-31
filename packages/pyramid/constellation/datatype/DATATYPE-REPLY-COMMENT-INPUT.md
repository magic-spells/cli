---
name: ReplyCommentInput
status: built
connections:
  - DATATYPE-COMMENT
---

Input for [[API-TOOL-REPLY-COMMENT]]. One level only — replying to a reply →
`reply_depth_exceeded`, rejected before the call ([[DOC-DESIGN-RULES]] rule 5).

```ts
interface ReplyCommentInput {
  comment_id: string;   // the ROOT comment being replied to
  content: string;
  mentions?: string[];
}
```
