---
name: Magic CLI
connected_repos:
  - name: sites
    path: ../sites
    description: "Magic Spells Sites — Go engine (`sites` binary, engine/ops registry, `sites mcp`), server (`/v1` API, pk_ keys), web and admin"
  - name: pyramid
    path: ../pyramid
    description: "Pyramid — project tracker; pyramid-cli (@magic-spells/pyramid 0.1.1) is this CLI's base and moves in; server gains the CLI session route"
  - name: marketing
    path: ../marketing
    description: "Marketing — email and events product; its unpublished TypeScript CLI (marketing/cli) moves in as packages/marketing"
  - name: sites-app-sdk
    path: ../sites-app-sdk
    description: "Sites App SDK — app framework for Sites; its developer commands ship here as `magic app …` (COMPONENT-SITES-APP-CLI there)"
  - name: account
    path: ../org/admin
    description: "Magic Spells Account — identity and billing; gains the `cli` application kind, device flow and identity-only introspection"
---

# Magic CLI

`magic` (repo `magic-spells/cli`, npm `magic-spells`, product name "Magic CLI") is the one public
command line and MCP server for Magic Spells' hosted services: Sites, Pyramid, Marketing, the Sites App SDK
and Account. One TypeScript package on Node 24, one binary, one `magic mcp` server. The top level belongs to
the person and the family (`magic login | logout | whoami | doctor | mcp | upgrade`); each product is a
namespace (`magic pyramid …`, `magic sites …`, `magic app …`, `magic marketing …`). It is not for the
open-source frameworks: Puzzle, puzzle-pieces and the Open Sourcery components keep their own CLIs
([[DECISION-NOT-FOR-FRAMEWORKS]], [[DECISION-ONE-CLI-FOR-HOSTED-SERVICES]]).

Two rules shape everything.

1. **Operations are the contract.** Every product package exports an operation registry (the zod
   `Operation` shape from the Pyramid CLI). The shell derives CLI commands and flags from it and
   `magic mcp` derives MCP tools from the same list; the operations layer knows nothing about either
   front-end ([[DECISION-OPERATIONS-ARE-THE-CONTRACT]], [[DECISION-OPERATION-CONTRACT]]). Sites keeps its Go
   registry and is reached through its own binary, not a TypeScript copy of its API
   ([[DECISION-SITES-VIA-BINARY-ADAPTER]]).
2. **Account identity, product authority.** `magic login` gets one identity-only grant from Account (device
   flow, or a loopback browser callback). Each product turns that grant into its own product-local key
   through `POST /v1/cli/sessions`, so every product keeps deciding who may do what in its own workspaces
   ([[DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY]]).

Around that: the Pyramid CLI is the base and its package is retired ([[DECISION-PYRAMID-CLI-IS-THE-BASE]]);
TypeScript on Node 24 ([[DECISION-TYPESCRIPT-ON-NODE-24]]); credentials in the OS keyring by default
([[DECISION-KEYRING-DEFAULT]]); one MCP server with product-prefixed tools ([[DECISION-ONE-MCP-SERVER]]);
public npm, published by GitHub Actions on a tag Cory pushes ([[DECISION-PUBLIC-NPM-RELEASE-ON-TAG]]).

Work that lands in another repo (Account, the Sites engine and server, the Pyramid server, Marketing) is
described here with a `**Lands in:**` first line; those repos write their own cards when the work starts.

## Current state

Planning only, as of 2026-10-18. Nothing is built; the repo has this plan, `CLAUDE.md`, `.nvmrc` (24) and
`research/` (`MAGIC-CLI-BRIEF.md`, the orchestrator's rulings; `research-magic-cli.md`, the survey of every
CLI in the family, the Sites operation registry, Account's auth shapes and the reference CLIs). Build order:
[[RELEASE-0-SCAFFOLD-AND-BASE]] (monorepo, kit, Pyramid moved in, product keys) →
[[RELEASE-1-LOGIN]] (Account `cli` kind, device flow, product sessions) → [[RELEASE-2-SITES]] (binary-backed
adapter, platform engine packages) → [[RELEASE-3-APP-SDK]] (`magic app …`) →
[[RELEASE-4-MARKETING-TELEMETRY-UPGRADE]]. Open questions are in [[DOC-OPEN-DECISIONS]]. Pictures:
[[DIAGRAM-ARCHITECTURE]], [[DIAGRAM-LOGIN]].

## Conventions

- Vocabulary: **workspace** (never organization), **handle** (never slug). Never name clients.
- Other platforms are named only in [[DOC-REFERENCE-MODELS]]; everywhere else they are "the reference CLIs".
- Every FEATURE names its RELEASE and, when the work is outside this repo, opens with `**Lands in:** …`
  (`account`, `sites/engine`, `sites/server`, `pyramid/server`, `marketing`, `sites-app-sdk`).
- Sibling-plan cards are cited in prose as `See [[HANDLE]] (sites plan)`, never as connections.
- Operations are named `product.noun.verb`; MCP tools are the same name with `_` (`pyramid_task_next`).
- No operation writes to stdout; stdout carries data (CLI) or JSON-RPC (MCP) only.
- Agents never tag or publish; Cory tags, GitHub Actions publishes.

## Last synced

No code yet. Plan authored 2026-10-18 from `research/MAGIC-CLI-BRIEF.md` rulings 1–10.
