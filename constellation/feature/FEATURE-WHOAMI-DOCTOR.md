---
name: 'whoami and doctor: who am I in each product, and is everything working'
status: built
release: RELEASE-0-SCAFFOLD-AND-BASE
change: feature
connections:
  - COMPONENT-SHELL
  - COMPONENT-LOGIN
  - COMPONENT-KIT
  - DATATYPE-PRODUCT-SESSION
  - DOC-COMMAND-TREE
notes:
  - kind: state
    text: >-
      Built (a337923, packages/cli/src/commands/{login,whoami,doctor}.ts). `magic login
      --product-key [<product>]`: key from a hidden TTY prompt or piped stdin (secret.ts), never
      argv — a positional containing `_` is refused without echo; product named or detected by key
      prefix; stored via the kit's saveProductKey as `<product>:manual`; prints `{ product, key
      (masked), stored_in: keychain|file }`, plus a stderr note when MAGIC_<PRODUCT>_KEY shadows it.
      `magic login` alone is a usage error pointing at --product-key (Account login is R1). `magic
      logout [--product p]` forgets the known `<product>:manual` items (never `security
      dump-keychain`), prints `{ removed: [...] }`. `magic whoami [--json]` → `{ account: null,
      products: { <id>: { source: env|keychain|file|none, key, identity, error? } } }`; identity is
      the product's `<id>.whoami` operation; exit = class of the first product error, 3 when no
      product has a key. `magic doctor [--json]` → `{ ok, checks }`: cli version, node >=24,
      credential store (file = warn, not fail; silent when MAGIC_CREDENTIALS_FILE=1), then per
      product `<id> api` (HEAD to the API URL, any HTTP answer passes), `<id> key`, and the
      product's doctor checks via runDoctorChecks(…, id) so every result carries `product`; exit =
      class of the first failure. Kit additions: CredentialStore.locate (which backend holds an
      item), contextFor. `magic pyramid login` kept as is (browser mint), not folded. Gates:
      cli/tests/commands.test.ts against a fake API (15 tests) incl. both acceptance rows.
      Deviations: doctor has no install-method or latest-version check (COMPONENT-UPGRADE is later);
      --workspace on top-level commands is a usage error.
    sha: '2952966'
---

# whoami and doctor

## Scope

- `magic whoami`: R0 — per product, the stored key's source (env, store, none), masked key, and the product's own whoami (Pyramid: user, workspace). R1 adds the Account identity (name, email, grant expiry) and every workspace reachable per product, marking the default. `--json` returns `{ account, products: { <id>: { workspaces, default, source } } }`.
- `magic doctor`: Node version, install method, CLI version vs latest, credential store backend (keyring or file, with the warning), per product: credential present, API reachable, auth valid; Sites: engine package present, version matches. Exit 0 when all pass, else the class of the first failure; `--json` lists every check.
- `magic login --product-key` and `magic logout` (R0 shapes from [[COMPONENT-LOGIN]]).

## Acceptance

- With only `MAGIC_PYRAMID_KEY` set, `magic whoami --json` shows Pyramid with `source: "env"` and the other products `source: "none"`.
- `magic doctor` on a machine without a keyring reports the file backend as a warning, not a failure.
