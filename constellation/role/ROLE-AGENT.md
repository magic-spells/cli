---
name: 'Agent: an AI client driving magic through MCP or the CLI'
status: planned
issued_by: 'The person who registered magic mcp or runs the agent; acts with that person''s product keys'
permissions:
  - 'inherits the person''s product roles'
connections:
  - DECISION-ONE-MCP-SERVER
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
  - COMPONENT-MCP-AGGREGATOR
  - FEATURE-MCP-AGGREGATOR
  - FLOW-MCP-TOOL-CALL
  - DOC-SECURITY
---

# Agent

An MCP client (or an agent running `magic … --json` in a shell). It never logs in by itself: it uses the credentials of the person who ran `magic login` or set `MAGIC_*_KEY`.

- Acts on error `code`s, never messages; reads `candidates` on `ambiguous_name`.
- Cannot run destructive operations unless the server's environment allows them.
- Sees only the products in `--products` when the person narrows it.
