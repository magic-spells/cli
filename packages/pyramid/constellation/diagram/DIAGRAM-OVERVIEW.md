---
name: System overview
status: built
connections:
  - EXTERNAL-PYRAMID-API
---

# System overview

Conceptual map: an AI client speaks MCP over stdio to the server, which resolves names to
IDs (cached), then calls the fixed Pyramid HTTP API as the key's user. The MCP holds no
state of its own.

```mermaid
flowchart LR
  AICLIENT["AI client (Claude Code / Desktop / Cursor)"] -->|stdio · MCP| FILE-SERVER
  FILE-SERVER --> FILE-RESOLVER
  FILE-SERVER --> FILE-ERRORS
  FILE-RESOLVER --> FILE-PYRAMID-CLIENT
  FILE-SERVER --> FILE-PYRAMID-CLIENT
  FILE-PYRAMID-CLIENT -->|"HTTPS · Bearer pyk_…"| EXTERNAL-PYRAMID-API
  FILE-CONFIG -.->|env at startup| FILE-SERVER
```

Names resolve through [[FILE-RESOLVER]] before any call; every response is hydrated and
every error normalized to [[DATATYPE-MCP-ERROR]].
