---
name: Rendering (MCP task cards)
kind: guide
status: built
connections:
  - DOC-ARCHITECTURE
  - FILE-SERVER
  - DATATYPE-TASK-SUMMARY
  - DATATYPE-TASK-DETAIL
  - DATATYPE-COMMENT
  - DOC-DESIGN-RULES
  - DOC-CLI-OUTPUT
---

# Rendering (MCP)

How task data is presented to the user. **The MCP returns structured, already-hydrated data**
(names, never UUIDs — [[DOC-DESIGN-RULES]] rule 4); the *recipe* below lives in the MCP server
`instructions` string ([[FILE-SERVER]]) and per-tool descriptions — **no skill file**. Claude
draws the card. (The CLI renders the same hydrated data its own way — [[DOC-CLI-OUTPUT]].)

## Canonical task card

Stage and status are always shown together as `Stage: Status` (the MCP derives the stage from
`status_id`). A task ([[DATATYPE-TASK-DETAIL]]) renders as a simple **left-rail** card — just
`│` (U+2502) down the left edge, **no top/bottom caps, no right border** — in a monospace block:

```
│ MOGO-123
│ NAME: Build site header
│ DESCRIPTION: build the site header with dropdown menus
│ Development: Ready for development
```

`│` gives an unbroken vertical line; a markdown blockquote is deliberately avoided because some
clients italicize it.

## Lists vs. detail (the over-fetch guard)

- **List / "get my work"** ([[DATATYPE-TASK-SUMMARY]]): a stack of these cards (one blank line
  between) with **DESCRIPTION truncated to one line** (`…`), capped at the page limit (~25), then
  "showing N of M — ask for more." Never auto-paginate ([[DOC-DESIGN-RULES]] rule 10). Default
  fields: ID, NAME, DESCRIPTION, `Stage: Status`.
- **Single `get_task`**: the full card + full description; then offer drill-in.

## Drill-in (same aesthetic)

On request, labeled left-rail sub-sections under the task — comments:

```
│ MOGO-123 — COMMENTS
│ @Sam (2d ago): design review pending
│   ↳ @Cory (1d ago): updated, take another look
```

and git references ([[DATATYPE-TASK-REFERENCE]]) grouped as PRs / commits / branches (each with
`#num`/`sha`, status, url). Comments: author + UTC/relative time + `content` (html stripped,
`@mentions` re-rendered from ids); cap to latest N. Reactions can't be read back — don't promise
them.

## Errors & dates

Never print raw JSON or an HTTP status. Translate [[DATATYPE-MCP-ERROR]] `code` to plain English;
on `ambiguous_*` show candidates and ask; on `auth_*` show the regenerate-key steps. Dates render
UTC-labeled or relative-with-label, never bare local ([[DOC-DESIGN-RULES]] rule 12).
