---
name: Comment tools
kind: guide
status: built
connections:
  - DATATYPE-COMMENT
  - API-TOOL-ADD-COMMENT
  - API-TOOL-REPLY-COMMENT
  - FILE-TOOLS-COMMENTS
  - PLAN-PHASE-2-CORE-TOOLS
---

# Comment tools

Comment operations are built in [[FILE-OPERATIONS]] and surfaced through [[FILE-SERVER]] /
[[FILE-CLI]].

| Tool | Returns | Notes |
|---|---|---|
| `list_comments(task, stage?, limit?, cursor?)` | [[DATATYPE-COMMENT]] page | stage-scoped; `stage` defaults to the task's current stage, `"all"` for every stage |
| `add_comment(task, content, stage?, mentions?)` | [[DATATYPE-COMMENT]] | root comment; defaults to current stage |
| `reply_to_comment(comment_id, content, mentions?)` | [[DATATYPE-COMMENT]] | one level only; reply-to-reply returns `reply_depth_exceeded` |

Reactions are not implemented in the shipped package.
