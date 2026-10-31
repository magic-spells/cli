---
name: src/operations/index.ts comment operations
status: built
path: src/operations/index.ts
language: typescript
summary: Comment read/write tools (stage-scoped, 1-level replies).
connections:
  - API-TOOL-ADD-COMMENT
  - API-TOOL-REPLY-COMMENT
  - DOC-TOOLS-COMMENTS
---

Comment operations live in [[FILE-OPERATIONS]] and are registered as tools by [[FILE-SERVER]]:
`list_comments` (stage-scoped), [[API-TOOL-ADD-COMMENT]], and [[API-TOOL-REPLY-COMMENT]].
The reply operation enforces the one-level reply rule before calling Pyramid
([[DOC-DESIGN-RULES]] rule 6). Reactions are not part of the shipped package.
