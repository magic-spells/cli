---
name: 'Marketing package (packages/marketing): Marketing''s unpublished TypeScript CLI moved in'
kind: product-package
status: planned
framework: typescript
connections:
  - COMPONENT-OPERATION-REGISTRY
  - COMPONENT-KIT
  - FEATURE-MARKETING-MOVE
  - API-MARKETING-CLI-SESSIONS
  - EXTERNAL-MARKETING
---

# Marketing package

From `marketing/cli` (`bin/marketing.ts` → `src/{operations,cli,mcp,client}`, `keychain.ts`, `config.ts`, `config-file.ts`, `errors.ts`, `webhooks.ts`; never published, name was `@magic-spells/marketing`).

- Operations: `marketing.contacts.get|list|upsert`, `marketing.events.track`, `marketing.campaigns.list`, `marketing.flows.list`, `marketing.lists.list`, `marketing.segments.list`, `marketing.reports.summary` (its 10 MCP tools today).
- Credential: `pmk_live_` / `pmk_test_`; `GET /api/v1/key` stays the doctor check. `MARKETING_API_KEY` → `MAGIC_MARKETING_KEY`; the keychain service `magic-spells-marketing` and the config file are dropped for the kit's.
- `login | whoami | logout` become the top-level commands.
