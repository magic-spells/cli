---
name: src/cli/index.ts
status: built
path: src/cli/index.ts
language: typescript
summary: Builds the pyramid subcommand tree from the operation registry; parses argv, renders human/JSON.
connections:
  - FILE-OPERATIONS
  - FILE-BIN
  - DATATYPE-CLI-OPTIONS
  - DOC-CLI
  - DOC-CLI-OUTPUT
  - DATATYPE-MCP-ERROR
---

Builds the `pyramid` command tree by walking [[FILE-OPERATIONS]]: each operation becomes a
`<group> <verb>` subcommand whose flags / positionals derive from its zod `input`. Parses argv
with a light parser (no heavy TUI dependency — keep the install MCP-only users carry small),
applies global flags ([[DATATYPE-CLI-OPTIONS]]) over the env config, invokes `operation.run`,
then hands the result — or a caught [[DATATYPE-MCP-ERROR]] — to the renderer (`src/cli/render.ts`)
which emits JSON or a human table and sets the process exit code per [[DOC-CLI-OUTPUT]].
Invoked by [[FILE-BIN]] for any argv whose first token isn't `mcp`.
