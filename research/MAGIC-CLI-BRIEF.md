# Magic CLI — planning brief (orchestrator, 2026-10-18)

Read with `research/research-magic-cli.md` (survey of the family's CLIs, the Sites operation registry, Account's auth shapes,
prior art — authoritative facts, built vs planned marked) and `../sites-app-sdk/research/DEVELOPER-PLATFORM-BRIEF.md` ruling 22.
Every card `status: planned`. Vocabulary: workspace (never organization); handle (never slug); other platforms named only in
DOC-REFERENCE-MODELS; never name clients.

## Cory's words (verbatim, 2026-10-18)
- "we might also want to start thinking about and planning a 'magic' CLI to go with this."
- "I think we'll also want the Magic CLI to support stuff for pyramid and Marketing and other things as well. should we build this
  in typescript so it's easy to run across multiple different systems?" → "ok so we'll want our CLI to be public then and use TS"
- "we should be using Node 24 on everything"
- "we can pull in pyramid here and use it as the base for our CLI. so they'll do 'magic whoami' and 'magic pyramid project list'"
  … "and then 'magic sites xxxx' and 'magic marketing xxxx'"
- "I think it's better to have one CLI that does everything than have 4 CLIs for each project."
- "puzzle is its own project and dev workflow, magic CLI is for magic spells services and products, not open source frameworks"
- "we can deprecate and archive pyramid CLI after this, pyramid isn't even launched yet so it's fine"
- Repo: GitHub `magic-spells/cli`, folder `cli`, npm `@magic-spells/cli`, binary `magic`, product name "Magic CLI".

## What it is
One public TypeScript command line and MCP server for Magic Spells' hosted services — Sites, Pyramid, Marketing, the Sites App
SDK, Account — in one npm package with one binary. Not for the open-source frameworks (Puzzle, puzzle-pieces, Open Sourcery
components keep their own CLIs). The Pyramid CLI (`pyramid/pyramid-cli`, `@magic-spells/pyramid` 0.1.1) is the base: its
operations registry, config, keychain, errors, render, hydrate and cache move in as the shared kit; the old package is deprecated
on npm and its repo archived with no migration period.

## Rulings

### 1. Shape
- `@magic-spells/cli` is the only published package; binary `magic`; `magic mcp` is the only MCP server. Product packages are
  workspaces inside this monorepo and are never published on their own. Node 24 (`engines >=24`, `.nvmrc`). Public on npm;
  source public on GitHub (MIT like pyramid-cli). `packages.magicspells.io` is for private SDKs and paid downloads, not this.
- Command tree: top level = the person and the family — `magic login | logout | whoami | doctor | mcp | upgrade`. Products are
  namespaces: `magic pyramid …` (the whole current `pyramid` tree), `magic sites …`, `magic app …` (the App SDK's `init | dev |
  check | version | publish | install | logs | events replay | import`; `sites app …` is retired before it ships), `magic marketing …`.
  `magic whoami` = Account identity + the workspaces reachable in each product; `magic pyramid whoami` keeps its product meaning.
- Global flags from pyramid-cli stay: `--json --yes/-y --no-color --quiet/-q --no-cache`, plus `--workspace <handle>` and
  `--product-key` escape hatches. Destructive operations stay gated (`yes` + env allow) as pyramid-cli does.
- Monorepo layout (npm workspaces): `packages/cli` (shell, bin, login, whoami, doctor, mcp aggregator, upgrade), `packages/kit`
  (shared kit, see 3), `packages/pyramid` (moved), `packages/marketing` (moved from marketing's unpublished TS CLI), `packages/app`
  (new; App SDK commands), `packages/sites` (adapter, see 4), `packages/sites-engine-<os>-<arch>` (platform binaries, see 4).
  Reference: Shopify/cli (oclif host + plugin packages on a shared cli-kit) — we copy the shape, not oclif.

### 2. Operations are the contract; CLI and MCP are two front-ends
- Every product package exports an **operation registry**: pyramid-cli's zod `Operation` shape (name, input schema, `meta.cli`
  for positionals/flags, destructive flag, run). The shell derives CLI flags from the schema (as pyramid does) and MCP tools from
  the same list; the operations layer knows nothing about either front-end. MCP tool names are product-prefixed
  (`pyramid_task_next`, `sites_pages_list`); `magic mcp --products pyramid,sites` limits what an agent sees.
- Two adapter kinds satisfy the same registry interface: **native TypeScript** (pyramid, marketing, app) and **binary-backed**
  (sites: see 4). The shell cannot tell them apart.
- Shared conventions across every product (new, record as DECISION-OPERATION-CONTRACT): operation naming `product.noun.verb`,
  destructive confirmation, exit codes, the error envelope (pyramid-cli's `errors.ts` codes + Sites' `ops.Error` codes mapped),
  `--json` output shape, cursor pagination flags, name→id resolution + hydration where a product supports it.

### 3. The shared kit (`packages/kit`, from pyramid-cli)
- config (env + file), **keychain** (cross-platform: macOS Keychain, Linux Secret Service, Windows Credential Manager via a
  maintained binding; file fallback 0600 with a warning — gh keeps keyring default, wrangler made it opt-in; we default to
  keyring), argv parsing + flag derivation from zod, render (table/json/quiet), errors, hydrate, cache, update notice + `magic
  upgrade` (copy Puzzle's cached-notice + upgrade pattern, DECISION-D76 in puzzle), MCP server builder with product prefixes,
  telemetry with an explicit consent prompt on first run (off until answered; `magic telemetry on|off`). Retire the four copied
  macOS-only Keychain wrappers and their four service names in favour of one service `io.magicspells.cli`.

### 4. Sites through its own binary, not a reimplemented API
- Sites' operation registry is Go (`engine/ops`), and `sites mcp` already exposes 59 tools with schemas. `packages/sites` is a
  **binary-backed adapter**: it spawns `sites mcp` over stdio as an MCP client, builds `magic sites …` from `tools/list`, and runs
  `sites dev|check` by shelling out. No TypeScript copy of `/v1` (that is the drift DECISION-CLI-MCP-SHARED-OPERATIONS rejected,
  and there is no OpenAPI to generate from). The Go binary ships as `@magic-spells/sites-engine-<os>-<arch>` optional
  dependencies pinned to the CLI version — Puzzle already does exactly this (`bin/puzzle.js`, `scripts/inject-platform-pins.mjs`);
  copy it. Lands in: sites/engine — the binary needs (a) a per-call token (env/flag, not only `sites login`), (b) `sites ops
  --json` catalogue + raw-JSON input mode, (c) release tags and a build matrix, (d) the module-path fix for the `engine/`
  subfolder (research §5). Future Go products (Wishlist) use the same adapter kind.

### 5. Login: Account identity, product authority
- Facts: Account has the PKCE handoff (30 s code → opaque grant, 14 d idle / 60 d absolute), client kinds web|ios|android|server,
  **no `cli` kind, loopback callbacks refused, no device flow**, and grants are scoped to ONE product (DECISION-PRODUCT-TRUST-BOUNDARY:
  a product can introspect only its own product's grants). No product accepts an Account grant today; each CLI uses its own key
  (`pk_`, `pyk_`, `pmk_`). Any browser-based login therefore needs an Account change; the smallest coherent one is below.
- Decision: **Account identity, product authority.** Account adds a `cli` application kind (public, PKCE, no secret) with a
  **device-code flow** (RFC 8628 — works over SSH and in containers; `gh`/`wrangler --device`) and a loopback callback exception
  for the desktop case. The `magic` CLI is registered as that application under a `magic` product. Its grants carry identity only
  (user id, display name, email) and are introspectable by **every** product — a bounded exception to the trust boundary for the
  `cli` kind alone, returning no entitlements and no `paid`. Each product then does what its web app already does with an
  Account identity: resolve the person's workspaces and roles **in that product**, and mint a product-local key (Sites `pk_`
  bound to the person's live grant — DB-ACCESS-KEYS already computes that; Pyramid `pyk_`; Marketing `pmk_`) through a new
  `POST /v1/cli/sessions` route that accepts the Account grant. The CLI stores the Account grant plus one key per product in the
  keychain and refreshes keys as they expire. `magic logout` revokes all of them. Rejected: one handoff per product (N browser
  trips, and still needs the Account callback change); a family-wide product (overturns the trust boundary for everything).
- Until Account ships the `cli` kind, R0 works exactly as pyramid-cli does: `magic login --product-key pyk_…` stores a product
  key; `magic whoami` reports per product. Lands in: account (`cli` kind, device flow, loopback exception, identity-only
  introspection across products), sites/server + pyramid/server + marketing (the `/v1/cli/sessions` mint route).

### 6. MCP
- `magic mcp` = one stdio server aggregating every product's operations with prefixes; `--products` filter; stdout is JSON-RPC
  only (pyramid rule). Registration: `claude mcp add magic -- npx -y @magic-spells/cli mcp`. Auth = the keychain from `magic
  login` (or product-key env vars for CI). Later option (open): a hosted HTTP MCP with OAuth (Vercel's model).

### 7. Distribution, release, upgrade
- npm publish on a tag by GitHub Actions; Cory tags (never the agents). One version for the whole CLI; platform engine packages
  pinned to it. `magic upgrade` + cached update notice. `npx -y @magic-spells/cli` zero-install path documented.
- Public docs site later (open: where — magicspells.io/docs/cli).

### 8. Releases
- **R0 Scaffold and base** — monorepo, kit extracted from pyramid-cli, `packages/pyramid` moved in and green, `magic pyramid …`,
  `magic whoami|doctor|mcp` with product keys, Node 24, CI, npm publish on tag; old `@magic-spells/pyramid` deprecated and its
  repo archived. Gate: `npx @magic-spells/cli pyramid task next` works with a `pyk_` key; `claude mcp add magic …` lists Pyramid tools.
- **R1 Login** — Account `cli` kind + device flow + identity-only introspection; `/v1/cli/sessions` in Sites and Pyramid; `magic
  login|logout|whoami` across products; keyring on all three OSes. Gate: one `magic login` yields working Sites and Pyramid keys.
- **R2 Sites** — binary-backed adapter, platform engine packages, `magic sites …` from `tools/list`, `magic sites dev|check`; Sites
  engine changes (a)–(d). Gate: `magic sites pages list` and `magic sites dev` on a theme folder.
- **R3 App SDK** — `magic app …` per the App SDK plan (its R1/R2 timing); `sites app …` never ships. Gate: the App SDK reference app
  goes init → dev site → publish via `magic app`.
- **R4 Marketing + telemetry + upgrade** — `packages/marketing` moved in; consent-gated telemetry; `magic upgrade`; docs site.
- Later: Reviews/Wishlist namespaces as those products ship; hosted MCP.

### 9. Card inventory (author in pyramid-cli's and Sites' card dialect; `**Lands in:**` for account/sites/pyramid/marketing work)
- decision/ DECISION-ONE-CLI-FOR-HOSTED-SERVICES (Context = Cory's quotes), DECISION-TYPESCRIPT-ON-NODE-24, DECISION-OPERATIONS-ARE-THE-CONTRACT,
  DECISION-OPERATION-CONTRACT (naming, errors, exit codes, destructive gate), DECISION-PYRAMID-CLI-IS-THE-BASE, DECISION-SITES-VIA-BINARY-ADAPTER,
  DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY, DECISION-KEYRING-DEFAULT, DECISION-ONE-MCP-SERVER, DECISION-PUBLIC-NPM-RELEASE-ON-TAG,
  DECISION-NOT-FOR-FRAMEWORKS (Puzzle stays its own)
- release/ RELEASE-0-SCAFFOLD-AND-BASE … RELEASE-4-MARKETING-TELEMETRY-UPGRADE
- component/ COMPONENT-SHELL, COMPONENT-KIT, COMPONENT-OPERATION-REGISTRY, COMPONENT-KEYCHAIN, COMPONENT-LOGIN, COMPONENT-MCP-AGGREGATOR,
  COMPONENT-PYRAMID-PACKAGE, COMPONENT-SITES-ADAPTER, COMPONENT-SITES-ENGINE-PACKAGES, COMPONENT-APP-PACKAGE, COMPONENT-MARKETING-PACKAGE,
  COMPONENT-UPGRADE, COMPONENT-TELEMETRY, COMPONENT-RENDER
- datatype/ DATATYPE-OPERATION, DATATYPE-ERROR-ENVELOPE, DATATYPE-CLI-CONFIG, DATATYPE-KEYCHAIN-ENTRY, DATATYPE-ACCOUNT-CLI-GRANT, DATATYPE-PRODUCT-SESSION
- api/ API-ACCOUNT-DEVICE-AUTHORIZATION (Lands in: account), API-ACCOUNT-CLI-INTROSPECT (account), API-SITES-CLI-SESSIONS (sites/server),
  API-PYRAMID-CLI-SESSIONS (pyramid), API-MARKETING-CLI-SESSIONS (marketing), API-SITES-OPS-CATALOGUE (sites/engine: `sites ops --json`)
- flow/ FLOW-LOGIN-DEVICE, FLOW-LOGIN-LOOPBACK, FLOW-PRODUCT-SESSION-MINT, FLOW-RUN-OPERATION, FLOW-MCP-TOOL-CALL, FLOW-SITES-ADAPTER-BOOT,
  FLOW-UPGRADE, FLOW-RELEASE-ON-TAG, FLOW-MOVE-PYRAMID-CLI
- feature/ FEATURE-MONOREPO-SCAFFOLD, FEATURE-KIT-EXTRACTION, FEATURE-PYRAMID-MOVE, FEATURE-WHOAMI-DOCTOR, FEATURE-MCP-AGGREGATOR,
  FEATURE-ACCOUNT-CLI-KIND, FEATURE-DEVICE-LOGIN, FEATURE-PRODUCT-SESSIONS, FEATURE-KEYRING, FEATURE-SITES-ADAPTER, FEATURE-SITES-ENGINE-PACKAGES,
  FEATURE-SITES-ENGINE-CHANGES (Lands in: sites/engine), FEATURE-APP-COMMANDS, FEATURE-MARKETING-MOVE, FEATURE-TELEMETRY, FEATURE-UPGRADE,
  FEATURE-RELEASE-PIPELINE, FEATURE-DEPRECATE-PYRAMID-CLI
- doc/ DOC-COMMAND-TREE, DOC-OPERATION-AUTHORING (how a product adds commands), DOC-REFERENCE-MODELS (the only card naming other platforms:
  Shopify/cli, gh, wrangler, Stripe CLI, Vercel), DOC-OPEN-DECISIONS, DOC-SECURITY (token storage, scopes, destructive gate)
- external/ EXTERNAL-ACCOUNT, EXTERNAL-SITES, EXTERNAL-PYRAMID, EXTERNAL-MARKETING, EXTERNAL-SITES-APP-SDK, EXTERNAL-NPM
- role/ ROLE-DEVELOPER, ROLE-MERCHANT-OPERATOR (non-dev MCP user), ROLE-AGENT
- diagram/ DIAGRAM-ARCHITECTURE, DIAGRAM-LOGIN

### 10. Open rows (DOC-OPEN-DECISIONS)
Hosted HTTP MCP with OAuth; docs site location; telemetry fields; whether `magic` also carries operator tools (`sites-internal`,
`accountctl`) behind an operator login (recommend no — separate binaries, private); keyring library choice; whether loopback
login ships in R1 or device flow alone; version policy once products add commands at different cadences (one CLI version, product
packages unversioned — recommend); Linux/Windows CI runners for keyring tests.
