---
name: 'Merchant operator: a non-developer who uses Magic Spells products through an agent'
status: planned
issued_by: 'Each product: a workspace membership (owner, admin or member)'
permissions:
  - sites:content
  - marketing:contacts
  - pyramid:tasks
connections:
  - DECISION-ONE-MCP-SERVER
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
  - FLOW-MCP-TOOL-CALL
---

# Merchant operator

Runs a store or a team, not code. Meets `magic` through an agent: registers `magic mcp` once (`claude mcp add magic -- npx -y magic-spells mcp`), runs `magic login` once, then asks the agent to update pages, check campaigns or file tasks.

- Needs clear tool descriptions, hydrated names (never ids), and errors that say what to do ("run magic login").
- Destructive tools stay blocked unless they started the server with `MAGIC_ALLOW_DESTRUCTIVE=1`.
