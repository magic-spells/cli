---
name: 'Render: table / JSON / quiet output and error printing, from pyramid-cli''s render.ts'
kind: library
status: planned
framework: typescript
connections:
  - COMPONENT-KIT
  - COMPONENT-SHELL
  - DATATYPE-ERROR-ENVELOPE
  - DECISION-OPERATION-CONTRACT
  - FLOW-RUN-OPERATION
---

# Render

pyramid-cli's `src/cli/render.ts` made generic: it owns format and streams, never business logic.

- JSON when `--json` or stdout is not a TTY; `--json` always wins. A TTY gets a compact table or lines.
- Products may register a human renderer per operation (Pyramid's task cards); the default renders arrays as tables of scalar fields and objects as `key: value` lines.
- Lists print `next_cursor` as a stderr hint ("more: --cursor …"), never auto-paginate.
- Errors: JSON mode prints the envelope to stderr; human mode one line `error [code]: message` plus `hint`, and candidates for `ambiguous_name`.
- `--quiet` suppresses stderr diagnostics except errors; `--no-color`/`NO_COLOR` disables ANSI.
