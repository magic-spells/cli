---
name: 'Marketing: the email and events API'
kind: external-microservice
status: planned
vendor: Magic Spells
purpose: 'Marketing operations with a pmk_ key; the CLI session route in R4'
credentials_envs:
  - MAGIC_MARKETING_KEY
connections:
  - COMPONENT-MARKETING-PACKAGE
  - API-MARKETING-CLI-SESSIONS
  - FEATURE-MARKETING-MOVE
  - DIAGRAM-ARCHITECTURE
---

# Marketing

Repo `marketing` (`cli/`, server, contracts with an OpenAPI file). Keys `pmk_live_` / `pmk_test_`, checked with `GET /api/v1/key`. Its CLI (`marketing/cli`, TypeScript, 10 MCP tools) is unpublished and moves in during R4 ([[FEATURE-MARKETING-MOVE]]).
