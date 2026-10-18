# Research: a family-wide `magic` CLI + MCP server

Date 2026-10-18. Read-only survey; no repo file was edited. **[B]** = built, **[P]** = planned, **[I]** = my inference, not stated in code or cards.
Cory's decision (from the coordinator): `magic` is **public, TypeScript, on npm**, with per-product command packages, and the Go Sites engine ships as **per-platform binary deps** (the esbuild/wrangler pattern).

Two things noticed along the way:
- `appkit` has been renamed on disk to `/Users/coryschulz/Code/@magic-spells/sites-app-sdk`.
- An empty `/Users/coryschulz/Code/@magic-spells/cli/` folder now exists.
- The `magic` CLI is already named as target item 22 in `sites-app-sdk/research/DEVELOPER-PLATFORM-BRIEF.md`, which says it "needs a `cli` client kind with the PKCE handoff".

---

## 1. Every CLI in the family today

| CLI | State | Lang | Entry | Auth | Credential storage | Distribution | MCP |
|---|---|---|---|---|---|---|---|
| `sites` | B | Go (stdlib `flag`) | `sites/engine/cmd/sites/main.go`, `cli.go`, `mcp.go` | `pk_` org/site access key | macOS Keychain via `/usr/bin/security`, service `dev.sites.cli`, account `credentials` (one JSON blob); elsewhere `$XDG_CONFIG_HOME/sites/credentials.json` 0600 | None. Repo `magic-spells/sites` is PRIVATE, no tags. Makefile builds it with `GOWORK=off` "as go install builds it" | Yes, `sites mcp` (stdio, go-sdk v1.4.0) |
| `sites-internal` | B | Go | `sites/server/cmd/sites-internal/{main,operators}.go` | HTTP server: Account session cookie + operator allowlist, behind Cloudflare Access. CLI part: `operator add\|revoke\|list` against the DB | DB env | Render service | No |
| `sites-devstack`, `sites-starters`, `sites-account-backfill` | B | Go | `sites/server/cmd/*` | DB / env | — | Dev and ops tools only | No |
| `accountctl` | B | Go | `org/admin/server/cmd/accountctl/main.go` | `DATABASE_URL` (direct DB, never HTTP, on purpose) | env | Render pre-deploy `/accountctl migrate up`, plus `go run` | No |
| `puzzle` | B | Go (cobra), npm bin shim | `puzzle/puzzle/packages/puzzle/bin/puzzle.js` → `compiler/cmd/puzzle/*` | None | none (update-check cache only) | npm `@magic-spells/puzzle` 0.8.0, Go binary in `@magic-spells/puzzle-{darwin-arm64,darwin-x64,linux-x64,linux-arm64,win32-x64}` optional deps | No |
| `puzzle add piece` | B | part of `puzzle` | `compiler/cmd/puzzle/add.go` | None | — | Reads registry from `--registry`, `$PUZZLE_PIECES_REGISTRY`, or the npm package `@magic-spells/puzzle-pieces` (now `puzzle/puzzle/packages/puzzle-pieces`, 0.8.0, matched on major.minor) | No |
| `create-puzzle-app` | Archived | Node | `puzzle/_archive/create-puzzle-app` | — | — | Not on npm (404) | No |
| `pyramid` | B | TypeScript | `pyramid/pyramid-cli/bin/pyramid.ts` → `src/{operations,cli,mcp,client}` | `pyk_` API key, `Authorization: Bearer` | env `PYRAMID_API_KEY` → Keychain (service `pyramid`) → `~/.config/pyramid/credentials.json` 0600 | npm `@magic-spells/pyramid` 0.1.1, public repo `magic-spells/pyramid-cli` | Yes, `pyramid mcp` (`@modelcontextprotocol/sdk`) |
| `marketing` | B | TypeScript | `marketing/cli/bin/marketing.ts` → `src/{operations,cli,mcp,client}` | `pmk_live_`/`pmk_test_` key, checked with `GET /api/v1/key` | Keychain service `magic-spells-marketing`, or a config file (macOS `~/Library/Application Support/magic-spells-marketing/config.json`, XDG/APPDATA elsewhere); `MARKETING_API_KEY` overrides | Not on npm (README: "Not published"; name `@magic-spells/marketing`) | Yes, 10 tools |
| `mspm` / `msp` | B | Node JS | `org/packages/cli/bin/mspm.js` | R2/KV operator secrets | Keychain service `io.magicspells.mspm`, one item per setting | Private, `npm link` from checkout only | No |
| `reviews` | P | Node (copy of Marketing's) | `reviews/constellation/component/COMPONENT-CLI-MCP.md` | `rk_live_` workspace key | — | — | Yes, `reviews mcp`, read-only tools |
| `wishlist` | P | **Go** (renders with the Sites engine) | `wishlist/constellation/component/COMPONENT-CLI-MCP.md`, `COMPONENT-THEME-CLI.md` | `wk_live_` key (`WISHLIST_API_KEY`) | — | single static binary | Yes |
| `wishlistctl` | P | Go | `wishlist/constellation/role/ROLE-STAFF.md`, `release/RELEASE-0-FOUNDATION.md` | DB / operator | — | pre-deploy | No |
| `sites app …` | P | Go, in the engine registry | `sites-app-sdk/constellation/component/COMPONENT-SITES-APP-CLI.md` | "own `sites login` session"; CI uses an `ak_` app key (`datatype/DATATYPE-APP-KEY.md`) | OS keychain | with `sites` | Yes, every command is a tool |

### Command trees

- **`sites`** [B], 59 MCP tools as of 2026-10-16:
  - `check`, `init`, `migrate` (theme codemod), `dev`, `dev stop` (MCP only), `version`, `mcp` (CLI only)
  - `login`, `keys add|list|remove`
  - `pull`, `push`, `data pull`
  - `theme list|pull|push|duplicate|publish|delete|preview|schema|deployments|deploy|deployments log|restore`
  - `pages list|get|create|update|publish|unpublish|delete`
  - `menus list|get|set`, `galleries list|get|set(|publish)`
  - `entries …`, `types …`, `designs …`
  - `site publish|preview|snapshot`
  - Global flag `--json`. Exit codes: 0 success, 1 theme diagnostics or API 404/422, 2 everything else.
  - Planned: `add section`, `--archive`, `app …`.
- **`accountctl`** [B]: `migrate up`, `app create --kind web|ios|android|server`, `app credential`, `session issue` (dev only), `admin bootstrap|recovery-codes|allowlist add`, `secrets rewrap|check`, `deletion fast-forward`, `comp add|remove`, `gift add`.
- **`puzzle`** [B]: `build`, `dev`, `preview`, `init`, `add <integration|piece|theme|skills>`, `check`, `doctor`, `generate`, `info`, `upgrade [skills]`, and a hidden `update-check`.
  - Update model (DECISION-D76-CLI-UPGRADE): a passive notice is printed from a cache; a detached process refreshes the cache hourly; it is gated by `CI`, `PUZZLE_NO_UPDATE_CHECK` and non-TTY output; `upgrade` drives the user's own package manager.
- **`pyramid`** [B]: 16 ops (`whoami`, `list_projects`, `get_project_workflow`, task read/write, comments) plus `set-key|show-key|logout|doctor`. CLI form is `<group> <verb>` (e.g. `task next|update|comment`). Destructive ops are gated by `PYRAMID_ALLOW_DESTRUCTIVE=1`.
- **`marketing`** [B]: `login|whoami|logout`, `contacts get|list|upsert`, `events track`, `campaigns|flows|lists|segments list`, `reports summary`.

**Pattern [B]:** every product CLI that exists or is planned is "one registry → CLI + MCP", modelled on DECISION-CLI-MCP-SHARED-OPERATIONS. Every one authenticates with a product-local prefixed API key. **None** authenticates through Account.

---

## 2. Sites' shared operation registry, and what a TypeScript `magic sites` needs

Sources: card `DECISION-CLI-MCP-SHARED-OPERATIONS` (sites root plan, built, verified at a465db4), `COMPONENT-SITES-CLI` and `DOC-CLI-REFERENCE` (engine plan), `FEATURE-CLI-AND-MCP` (root plan).

### How it works [B]

- An operation is declared in `sites/engine/ops/ops.go`, registered in `sites/engine/ops/builtin/builtin.go`. It has:
  - `Name`: dotted, e.g. `theme.push`
  - `Summary` and `Detail`
  - `Surfaces`: empty means both; otherwise `cli` or `mcp`
  - `Input`: a struct whose `json` and `description` tags become JSON Schema via `ops/schema.go`; a field can be tagged `surface:"cli"`
  - `Run(ctx, json.RawMessage, io.Writer) (any, error)`
- Errors are `ops.Error{Code, Message, Hint}`. Codes: `unknown_operation`, `invalid_input`, `not_available`, `theme_diagnostics`, `failed`, `conflict`, plus API wire codes.
- Hard rule: an operation never writes to stdout.
- **CLI** (`cmd/sites/cli.go`): turns dots into subcommands, schema properties into `flag`s, takes one positional "subject", and prints the result as text (`WriteHuman`) or `--json`.
- **MCP** (`cmd/sites/mcp.go`): turns dots into `_`, passes the registry's schema through unchanged, and returns the result or `{error, result}` as JSON text with `IsError`.
- Credentials are resolved inside the ops through `internal/keychain`: an exact site binding wins, then org keys probed with `GET /v1/sites/:id`, then the `login` key for the API host.
  - `SITES_API` overrides the host.
  - `SITES_TOKEN` is read **only by `login`**, never at call time.

### How an external TypeScript host could drive it

1. **Spawn `sites mcp` and act as an MCP client** [I, recommended]. It needs no change to Sites:
   - `tools/list` gives names, descriptions and JSON Schemas.
   - `tools/call` gives structured results and errors.
   - `magic sites <x>` can build its commander/yargs tree from `tools/list`.
   - `magic mcp` can re-expose the tools with a `sites_` prefix, or the client can register `sites mcp` directly.
   - Puzzle's npm shim (`bin/puzzle.js` + `scripts/inject-platform-pins.mjs` + the `npm/puzzle-*` packages) is already this exact binary-in-optional-deps pattern inside the family. Copy it for `@magic-spells/sites-<os>-<arch>`.
2. **Subprocess `sites <op> --json`** [I]. This is the shell-out option DECISION-CLI-MCP-SHARED-OPERATIONS rejected for MCP. As a CLI pass-through it is fine for `dev` (long-running, TTY, `r`+Enter refresh). But flags are re-parsed, and there is no raw-JSON input mode.
3. **Import as a Go module.** This does not apply to a TypeScript host. Also, `ops/builtin` imports `sites/internal/*` and the module lives in a subdirectory with module path `github.com/magic-spells/sites`. [I] `go install`/`go get` of `…/sites` would not resolve to `engine/` without a module-path change, and the repo is private.
4. **Talk straight to the `/v1` HTTP API from TypeScript** for the non-local ops (pages, entries, themes …). That re-implements ~45 ops in a second runtime, which is the drift DECISION-CLI-MCP-SHARED-OPERATIONS rejected ("A separate Node MCP package"). There is no OpenAPI for Sites `/v1` (only the hand-written `sites/server/docs/api.md`), so there is nothing to generate a client from.

### What the Go `sites` binary would need for a TypeScript wrapper [I]

- **Credential injection.** The TypeScript layer needs to pass a token per call (env `SITES_TOKEN` honoured by `siteClient`, or a `--token-fd` / stdin-JSON handshake) instead of the binary owning its own Keychain blob. Otherwise `magic login` and `sites login` keep two stores.
- **A machine catalogue on the CLI side.** Something like `sites ops --json` (registry + schemas + surfaces + `Detail`) and a raw `--input '<json>'` mode, so the CLI path doesn't need MCP framing. This also gives `DOC-CLI-REFERENCE` its missing generated docs: the card itself says the reference is hand-written and can go stale.
- **A version handshake.** `version` exists, so `magic` can pin or verify the binary version it shipped against.
- **Accepting an Account grant.** See section 3. Today `sites-api` accepts exactly one Bearer kind, `pk_` (`sites/server/internal/middleware/auth.go: accessKeyPrefix = "pk_"`). No `GrantMiddleware` or `IntrospectGrant` is used anywhere in sites/server.
- A **published release** of the engine binary: tags plus a cross-compile matrix. Sites has no tags and no release script, unlike Puzzle's `scripts/release-prep.mjs`.

### Is pyramid-cli a reusable model for the per-product packages? Largely yes [B/I]

- `src/operations/index.ts` is the TypeScript twin of Sites' registry:
  - `Operation { name, summary, input: zod object, run(input, ctx), meta?: { cli: {group, verb, positionals, aliases}, destructive } }`
  - `OpContext { config, client, resolver }`
  - one flat `operations[]`
- `src/cli/index.ts` derives the command tree and flags by introspecting zod. `src/mcp/server.ts` passes `input.shape` to `@modelcontextprotocol/sdk`.
- Marketing's `cli/` has the same layout (`operations/ cli/ mcp/ client/ keychain.ts`), and Reviews is planned as a copy of Marketing. So **three TypeScript packages already share one shape**, built by copying rather than through a shared library.
- What a `magic` plugin contract would need to factor out [I]:
  - the auth and keychain layer (today it is copied three times, with three different service names)
  - argv parsing (hand-rolled per package)
  - render and `--json` output
  - the error envelope
  - `doctor`
  - Each product package would then export `operations[]`, a client factory, and a plugin manifest.
- Mismatches to resolve:
  - zod 3 is used in both; keep them aligned.
  - Pyramid's MCP tool names are `snake_case` without a product prefix; Sites uses dotted names turned into `_`. A family MCP needs namespacing, e.g. `pyramid_list_tasks` or `sites_theme_push`.
  - Pyramid has a resolver/hydration layer (names → ids) that is product-specific and should stay in the product package.

---

## 3. Account auth shapes a CLI could use

Org/admin cards:
- `api/API-AUTH-AUTHORIZE`, `api/API-AUTH-TOKEN`, `api/API-INTERNAL-GRANTS-INTROSPECT`, `api/API-SESSION-INTROSPECT`
- `feature/FEATURE-PHASE-5-NATIVE-HANDOFF` (server side built)
- `decision/DECISION-PRODUCT-TRUST-BOUNDARY`, `decision/DECISION-OPAQUE-SESSIONS`
- `doc/DOC-MAGICSPELLS-SDK`, `db/DB-APPLICATIONS`, `db/DB-CLIENT-CREDENTIALS`

### The handoff [B]

- `GET /auth/authorize` takes `client_id`, `redirect_uri` (exact string match against registered callbacks), `state`, and S256 PKCE. `prompt` is only `login`; `scope` is only `basic`. Deliberately not OIDC.
- A live session still needs an explicit confirm on `/auth/continue`.
- `POST /auth/token` is form-encoded with no query string. It exchanges a 30-second single-use code, plus `code_verifier` (and `client_secret` for web), for an **opaque grant**: `{token_type:"Bearer", access_token, expires_in: 5184000, grant_id}`.
  - Lifetime: **60 days absolute, 14 days idle**, no refresh rotation.
  - Grant kind is `native` for ios/android, `external_browser` otherwise.
- **Client kinds:** `web` (confidential), `ios`, `android` (public, PKCE only, may register a custom-scheme callback), `server` (holds credentials, no callbacks). Defined in `org/admin/server/internal/store/registry.go`.
  - **There is no `cli` kind.**
  - `ValidHandoffCallback` says outright: "Loopback http callbacks are not accepted for any kind". Callbacks are exact https URLs (or custom schemes for mobile), with no wildcard, so the RFC 8252 any-port loopback pattern is impossible today.
  - There is **no device-authorization grant** (RFC 8628).
- **Introspection:** `POST /internal/v1/grants/introspect`, only on the private `INTERNAL_URL` host.
  - Needs a server credential with the `grants.introspect` operation.
  - Returns the session envelope (`active`, `user{…, entitlements}`, `paid`, `session{id = grant id}`) plus `grant_id` and `application` at the root.
  - In the Go SDK: `accounts.IntrospectGrant` / `accounts.GrantMiddleware` in `magicspells-sdk` (Go module `github.com/magic-spells/admin/packages/magicspells-sdk`, distributed as a zip on packages.magicspells.io via `mspm`; Sites pins 0.6.0).
  - **Trust boundary:** a grant is introspectable **only by the product its application belongs to** (DECISION-PRODUCT-TRUST-BOUNDARY). One grant from one `magic login` cannot be checked by both Sites and Wishlist.

### What `magic login` needs from Account [P/I]

- A `cli` application kind: public, PKCE-only, no secret. Callback options are either loopback `http://127.0.0.1:{any port}/callback` per RFC 8252 (needs an explicit exception to the current "no loopback" rule and port-agnostic matching), and/or a **device-code flow** for SSH/headless use, like `wrangler login --device` and Stripe's pairing code.
  - [I] A stop-gap that works today: register an `ios`-kind public app whose https callback is an Account-hosted page that shows the code for the user to paste into the terminal. That bends the kind's meaning.
- A **cross-product answer.** Options [I]:
  - (a) one `cli` application per product, so `magic login` runs N handoffs or one handoff mints N grants
  - (b) a "family" product whose grant every product may introspect, which overturns DECISION-PRODUCT-TRUST-BOUNDARY
  - (c) **token exchange**: the CLI holds an Account grant, and each product swaps it for a product-local token (e.g. a short-lived Sites `pk_`-equivalent scoped to the person's org role). Option (c) keeps the trust boundary and reuses each product's existing key and scope model (`DB-ACCESS-KEYS` already computes "key borrows a person's live authority").
- A **TypeScript Account client.** The SDK is Go only; the CLI side needs nothing but `/auth/authorize` + `/auth/token`, which is easy to write by hand.

### How Sites would accept it today

- It doesn't. `sites-api` accepts the shared `__Secure-ms_session` cookie (browser, CSRF-guarded, introspected with `SITES_ACCOUNT_*`) or a `pk_` key (`EXTERNAL-ACCOUNT-IDENTITY`, `DB-ACCESS-KEYS`).
- Adding grants means:
  - a `sites-cli` application in product `sites`
  - `grants.introspect` added to Sites' server credential
  - `GrantMiddleware` on `/v1` beside the `pk_` path, with CSRF exemption like `pk_`
  - an organization/role resolution step, because a grant names a person, not an org
- `sites-app-sdk` `COMPONENT-SITES-APP-CLI` already assumes "people authenticate with their own `sites login` session". That session does not exist: `sites login` stores a `pk_`.

---

## 4. Prior art (brief; web sources plus general knowledge [I])

- **Shopify CLI:** an oclif host (`shopify`) plus plugin packages (`@shopify/app`, `@shopify/theme`, `@shopify/cli-hydrogen`) on a shared `@shopify/cli-kit` (UI, auth, session). Auth is a browser OAuth login against Shopify identity and Partners, with a session cached in the user config dir [I]. This is the closest model for "host + per-product packages + shared kit".
- **gh:** single Go binary. `gh auth login` uses the OAuth device flow (or web) and stores the token in the OS keyring by default, falling back to plaintext with `--insecure-storage` (as described by the GitLab CLI MR that copies it). Extensions are separate executables named `gh-<name>`, installed from git repos and run as subprocesses [I]. That is a good model for "a product ships its own binary".
- **wrangler:** TypeScript on npm, with native deps (workerd, esbuild) as per-platform packages. `wrangler login` uses an OAuth browser callback, with `--device` for the RFC 8628 device grant. Tokens go in a plaintext TOML by default; `--use-keyring` (changelog 2026-06-03) is opt-in. Collects telemetry with a consent prompt [I].
- **Stripe CLI:** single Go binary (Homebrew, scoop, apt). `stripe login` shows a pairing code and confirms in the dashboard, then stores restricted keys in `~/.config/stripe/config.toml` (plaintext). `--interactive` takes a pasted key for headless use.
- **Vercel:** TypeScript on npm. MCP is a **hosted** Streamable HTTP server at `mcp.vercel.com` with OAuth per client and a client allowlist, not something the CLI exposes. [I] Hosted MCP is worth considering later, beside a local stdio `magic mcp`, for the API-only ops.

Copy:
- the host + plugin-package split (Shopify/oclif)
- the platform-binary optional deps (wrangler, esbuild, and Puzzle's own shim)
- keychain-first storage with a 0600-file fallback (gh; already the family's habit)
- device flow plus browser loopback (gh, wrangler)
- a cached, non-blocking update notice (Puzzle D76)

---

## 5. Gaps for one `magic` CLI

1. **Shared auth.**
   - No Account `cli` client kind.
   - No loopback or device flow.
   - Grants are product-scoped.
   - No product's API accepts an Account grant from a non-browser client yet. Sites accepts `pk_` only; Pyramid, Marketing, Reviews and Wishlist use `pyk_`, `pmk_`, `rk_`, `wk_` keys.
   - Decide: token exchange (keeps the trust boundary) vs per-product handoffs vs a family product.
2. **Per-product operation contract.**
   - Go (Sites, planned Wishlist) and TypeScript (Pyramid, Marketing, Reviews) registries agree in spirit, but there is no shared contract: names, namespacing, schema dialect, error envelope (`ops.Error` vs Pyramid's `McpError`), `destructive`/`yes` confirmation, surface flags, exit codes.
   - Needed: a `magic` plugin interface (TypeScript), plus a wire contract for Go products (MCP `tools/list` + `tools/call` over a spawned `<product> mcp` is the cheapest common denominator).
3. **Sites binary readiness.**
   - No published binary, no tags, no cross-compile/release script.
   - Private repo.
   - Module path vs `engine/` subdir mismatch [I].
   - No call-time token injection.
   - No `ops --json` catalogue or raw-JSON input.
   - No Sites `/v1` OpenAPI.
4. **Release / update channel.**
   - npm for public TypeScript packages is fine; Puzzle's `prepack` pin-injection and verify-pack scripts are the template.
   - `packages.magicspells.io` (Cloudflare Worker + R2, `mspm`, `org/packages`) is for private SDKs and paid downloads, so it is not suitable for a public CLI.
   - Needed: a lockstep or compatibility matrix between `magic`, each product package, and the bundled `sites` binary, plus a D76-style notice and `magic upgrade`.
5. **Keychain storage.**
   - Four hand-rolled `security` wrappers with four service names (`dev.sites.cli`, `pyramid`, `magic-spells-marketing`, `io.magicspells.mspm`).
   - macOS only; everything else gets a plaintext 0600 file. No Linux libsecret or Windows Credential Manager support.
   - Needs one shared store (one service such as `io.magicspells.cli`, one item per credential), plus migration and import of existing product keys.
6. **Telemetry / consent.** None anywhere (no telemetry code in the Sites engine or Puzzle CLI [B, grep]). If wanted: an opt-in prompt, `MAGIC_TELEMETRY=0`, and `CI` detection.
7. **Versioning across products.** Every product versions independently (Puzzle 0.8.0, Pyramid 0.1.1, Marketing 0.1.0 unpublished, Sites release/0.2.0 untagged). `magic` needs a declared minimum per plugin and an API-version handshake. `COMPONENT-SITES-APP-CLI` already wants an `api_version` floor.
8. **Naming and doc churn.** The App SDK cards still say `sites app …`; DEVELOPER-PLATFORM-BRIEF item 22 says rename them to `magic app …`, with `sites app` kept as an alias. Wishlist/Reviews CLI cards are per-product binaries (`wishlist`, `reviews`) and would become `magic wishlist` / `magic reviews` packages.
9. **MCP aggregation.** `magic mcp` must namespace tools across products, handle per-product auth failures in isolation, and choose between proxying a child `sites mcp` and loading everything in-process.

## Sources (web)
- Shopify CLI repo summary: https://gittrend.io/repo/Shopify/cli ; manifest: https://cdn.jsdelivr.net/npm/shopify@4.2.0/package.json
- GitLab CLI keyring MR (gh parity): https://gitlab.com/gitlab-org/cli/-/merge_requests/3528
- Stripe CLI login: https://docs.stripe.com/cli/login.md
- Wrangler keyring changelog: https://developers.cloudflare.com/changelog/post/2026-06-03-wrangler-keyring-credential-storage/ ; commands: https://developers.cloudflare.com/workers/wrangler/commands/general/
- Vercel MCP: https://vercel.com/blog/introducing-vercel-mcp-connect-vercel-to-your-ai-tools
