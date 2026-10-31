---
name: 'Security: token storage, scopes, the destructive gate, what never reaches argv or stdout'
kind: rule
status: planned
connections:
  - DECISION-KEYRING-DEFAULT
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - DECISION-OPERATION-CONTRACT
  - COMPONENT-KEYCHAIN
  - COMPONENT-LOGIN
  - COMPONENT-TELEMETRY
  - FEATURE-KEYRING
  - FEATURE-TELEMETRY
  - ROLE-AGENT
notes:
  - kind: decision
    text: >-
      2026-10-31: credential prefixes are product-named: Pyramid `pyramid_` (`pyramid_<8>_<32>`,
      replacing `pyk_`, no legacy acceptance), Sites `sites_`, Marketing `marketing_<mode>_`, and
      the Account grant `magic_` planned for R1. Why: a key's owner is readable at a glance and
      `magic login --product-key` routes by prefix.
---

# Security

## Credentials


- **What is held.** One Account `cli` grant (identity only, 60 days absolute, 14 idle) and short-lived product keys (24 h, re-minted). A stolen product key is bounded by its expiry and the person's live role; a stolen grant can mint keys until revoked, so `magic logout` revokes it server-side.
- **Where.** The OS keyring under `io.magicspells.cli`; the 0600 file only with a warning or on purpose ([[DECISION-KEYRING-DEFAULT]]). Environment variables for CI only.
- **Never in argv.** No flag takes a secret as its value. `--product-key` prompts (hidden input) or reads stdin (`echo $KEY | magic login --product-key -`). The keyring binding replaces pyramid-cli's `security -w <key>`, which exposes the key in the process list. Child processes (the Sites engine) get keys through the environment, never argv.
- **Never printed.** Keys show masked, prefix plus last 4 (`pyramid_<prefix>_…abcd`); `--json` output never includes a key; debug logs redact `Authorization`.
- **Loopback login.** The callback server binds 127.0.0.1 only, checks `state`, uses PKCE, accepts one request on `/callback`, and closes. Pyramid's interim `/auth/cli` delivers the key in a urlencoded POST body to the loopback listener, never in the URL; a GET or a `key` in the query string is refused unread. That path ends in R1.

## Scopes

- The Account grant carries identity only; every authorisation decision is the product's, made on its own key with the person's role in that workspace.
- Product keys are workspace-scoped; a person with three workspaces gets three keys.
- CI uses product or app keys (`MAGIC_*_KEY`, `MAGIC_APP_KEY` with `ak_`), never an Account grant.

## Destructive gate

- `meta.destructive` operations need `--yes`/`yes: true` **and** `MAGIC_ALLOW_DESTRUCTIVE=1`. The env half keeps an agent from deleting through `magic mcp` unless the person who started the server allowed it.
- Destructive means: delete, archive, unpublish or publish to the public, overwrite without a version, revoke.

## Agents

- `magic mcp` runs with the person's own authority; tool descriptions say which tools write.
- Tool results are data. Product content returned to an agent (task descriptions, page bodies) is never treated as instructions by `magic` itself.

## Telemetry

- Off until consent; no argument values, paths, handles, emails or keys are ever sent ([[COMPONENT-TELEMETRY]]).
