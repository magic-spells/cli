---
name: reply_to_comment
kind: mcp-tool
status: built
methods:
  POST:
    request_schema: DATATYPE-REPLY-COMMENT-INPUT
    response_schema: DATATYPE-COMMENT
connections:
  - FILE-TOOLS-COMMENTS
  - DOC-DESIGN-RULES
  - PLAN-PHASE-2-CORE-TOOLS
---

`reply_to_comment` — reply to a ROOT comment ([[DATATYPE-REPLY-COMMENT-INPUT]] →
[[DATATYPE-COMMENT]]). One level only — replying to a reply → `reply_depth_exceeded`, rejected
before the call ([[DOC-DESIGN-RULES]] rule 5). Wraps `POST /v1/comments/{id}/replies`.
