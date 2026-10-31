---
name: AddCommentInput
status: built
connections:
  - DATATYPE-COMMENT
---

Input for [[API-TOOL-ADD-COMMENT]]. Comments are stage-scoped; `stage` defaults to the
task's current stage when omitted ([[DOC-DESIGN-RULES]] rule 4).

```ts
interface AddCommentInput {
  task: string;         // "WEB-42" or UUID
  content: string;
  stage?: string;       // name/key; default = task's current stage
  mentions?: string[];  // user names/emails → resolved to UUIDs
}
```
