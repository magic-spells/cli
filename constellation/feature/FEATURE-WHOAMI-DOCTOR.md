---
name: 'whoami and doctor: who am I in each product, and is everything working'
status: planned
release: RELEASE-0-SCAFFOLD-AND-BASE
change: feature
connections:
  - COMPONENT-SHELL
  - COMPONENT-LOGIN
  - COMPONENT-KIT
  - DATATYPE-PRODUCT-SESSION
  - DOC-COMMAND-TREE
---

# whoami and doctor

## Scope

- `magic whoami`: R0 — per product, the stored key's source (env, store, none), masked key, and the product's own whoami (Pyramid: user, workspace). R1 adds the Account identity (name, email, grant expiry) and every workspace reachable per product, marking the default. `--json` returns `{ account, products: { <id>: { workspaces, default, source } } }`.
- `magic doctor`: Node version, install method, CLI version vs latest, credential store backend (keyring or file, with the warning), per product: credential present, API reachable, auth valid; Sites: engine package present, version matches. Exit 0 when all pass, else the class of the first failure; `--json` lists every check.
- `magic login --product-key` and `magic logout` (R0 shapes from [[COMPONENT-LOGIN]]).

## Acceptance

- With only `MAGIC_PYRAMID_KEY` set, `magic whoami --json` shows Pyramid with `source: "env"` and the other products `source: "none"`.
- `magic doctor` on a machine without a keyring reports the file backend as a warning, not a failure.
