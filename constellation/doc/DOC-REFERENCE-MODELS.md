---
name: 'Reference models: the CLIs we copy from, what we copy and what we avoid'
kind: guide
status: planned
connections:
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
  - DECISION-KEYRING-DEFAULT
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - DECISION-SITES-VIA-BINARY-ADAPTER
  - DECISION-ONE-MCP-SERVER
  - COMPONENT-TELEMETRY
---

# Reference models

**This is the only card in the Magic CLI plan that names other platforms.** Everywhere else they are "the reference CLIs". Facts as of 2026-10-18 from `research/research-magic-cli.md` §4; items marked [I] are inference or general knowledge, not checked against source.

## Shopify CLI — host + plugin packages on a shared kit

- An oclif host (`shopify`) plus plugin packages (`@shopify/app`, `@shopify/theme`, `@shopify/cli-hydrogen`) on a shared `@shopify/cli-kit` (UI, auth, session). MIT.
- Auth: browser OAuth against Shopify identity and Partners; session cached in the user config dir [I].
- **Copy:** the host + per-product package split on one kit ([[COMPONENT-KIT]]).
- **Avoid:** the oclif framework itself and separately published plugin packages — our registry already derives the tree, and one version is simpler.
- Sources: https://gittrend.io/repo/Shopify/cli ; https://cdn.jsdelivr.net/npm/shopify@4.2.0/package.json

## GitHub CLI (gh) — device flow and keyring by default

- Single Go binary. `gh auth login` uses the OAuth device flow (or web); the token goes in the OS keyring by default, with plaintext only by opting in (`--insecure-storage`), as described in the GitLab CLI merge request that copies it.
- Extensions are separate executables `gh-<name>`, installed from git repos and run as subprocesses [I].
- **Copy:** device flow + browser login; keyring by default ([[DECISION-KEYRING-DEFAULT]]); a product that ships its own binary run as a subprocess (our Sites adapter).
- Source: https://gitlab.com/gitlab-org/cli/-/merge_requests/3528

## Cloudflare wrangler — TypeScript on npm with native binaries per platform

- TypeScript on npm; native dependencies (workerd, esbuild) as per-platform packages.
- `wrangler login` uses an OAuth browser callback, with `--device` for the RFC 8628 device grant.
- Tokens in a plaintext TOML by default; `--use-keyring` added as opt-in (changelog 2026-06-03).
- Telemetry with a consent prompt [I].
- **Copy:** per-platform optional dependencies ([[COMPONENT-SITES-ENGINE-PACKAGES]]); device login; consent-gated telemetry ([[COMPONENT-TELEMETRY]]).
- **Avoid:** plaintext tokens by default.
- Sources: https://developers.cloudflare.com/changelog/post/2026-06-03-wrangler-keyring-credential-storage/ ; https://developers.cloudflare.com/workers/wrangler/commands/general/

## Stripe CLI — pairing code

- Single Go binary (Homebrew, scoop, apt). `stripe login` shows a pairing code confirmed in the dashboard, then stores restricted keys in `~/.config/stripe/config.toml` (plaintext). `--interactive` takes a pasted key for headless use.
- **Copy:** the code shown in the terminal and confirmed in the browser (our device page shows the code and the CLI's name); a pasted-key path for headless use (`--product-key`).
- **Avoid:** plaintext key storage.
- Source: https://docs.stripe.com/cli/login.md

## Vercel — hosted MCP

- TypeScript CLI on npm. MCP is a **hosted** Streamable HTTP server at `mcp.vercel.com` with OAuth per client and a client allowlist, not something the CLI exposes.
- **Consider later:** a hosted HTTP MCP beside the local stdio `magic mcp`, for API-only operations (open row in [[DOC-OPEN-DECISIONS]]).
- Source: https://vercel.com/blog/introducing-vercel-mcp-connect-vercel-to-your-ai-tools

## Inside the family (not other platforms, listed for completeness)

- Puzzle's npm shim and pin injection (`bin/puzzle.js`, `scripts/inject-platform-pins.mjs`) and its cached update notice (DECISION-D76-CLI-UPGRADE, puzzle plan) — copied directly.
