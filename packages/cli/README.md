# magic-spells

`magic`: one command line and MCP server for Magic Spells' hosted services. Node 24 or newer.

```sh
npx -y magic-spells --help      # or: npm i -g magic-spells
```

## Sign in

```sh
magic login              # opens your browser; or prints a code when there is none
magic login --device     # always use a code (SSH, containers, another device)
magic whoami             # your account, and your workspaces and keys in each product
magic logout             # revoke your keys and sign-in, forget everything stored
```

`magic login` signs in to your Magic Spells account, then mints a short-lived key (24 h)
in Pyramid, Sites and Marketing for every workspace you belong to. Expired keys are
re-minted for you while your sign-in lives (60 days, or 14 days unused); a product where
you have no workspace is skipped. With a local browser it uses a one-time callback on
`127.0.0.1` (PKCE); over SSH or on Linux without a display it uses a code you enter at
the verification page on any device. With several workspaces in a product, pick one per
command with `--workspace <handle>` (or set `defaultWorkspace` in
`~/.config/magic/config.json`). `magic login --product <p>` re-mints one product;
`magic logout --product <p>` forgets one.

Credentials live in the macOS Keychain (service `io.magicspells.cli`) or, elsewhere, a
mode-0600 file in `~/.config/magic/credentials.json`: `account:grant`, `account:sessions`
and one `<product>:<workspace>` item per key.

### Product keys (CI)

```sh
echo "$KEY" | magic login --product-key pyramid   # or paste at the hidden prompt
export MAGIC_PYRAMID_KEY=pyramid_…                    # or just set the variable
```

Keys are read from the prompt or stdin, never from arguments. A key in the environment
wins over a stored one; pasted keys are never re-minted.

## Commands

| Command | Does |
|---|---|
| `magic login [--device] [--product <p>] [--yes]` | sign in to your account and mint product keys |
| `magic login --product-key [<product>]` | store a product key (product detected from the key's prefix) |
| `magic logout [--product <p>]` | revoke and forget credentials |
| `magic whoami [--json]` | your account (name, email, sign-in expiry) and per product: key source (env, account, manual, none), workspaces, default, masked keys |
| `magic doctor [--json]` | Node, credential store, Account and your sign-in, and per product: API reachable, key present, product checks |
| `magic mcp [--products a,b]` | the MCP server over stdio: every product's tools, prefixed (`pyramid_*`) |
| `magic pyramid <noun> <verb>` | Pyramid: `task next`, `task move WEB-42 --status "In Review"`, `task comment`, `project list`, `whoami`, … (`magic pyramid --help`) |

Global flags: `--json`, `--yes/-y`, `--no-color`, `--quiet/-q`, `--workspace <handle>`.
Output is JSON whenever stdout is not a terminal; errors go to stderr as
`{ "error": { "code", "message", "hint", "product" } }`.

## MCP

```sh
claude mcp add magic -- npx -y magic-spells mcp
```

It uses the keys `magic login` stored (and re-mints them when they expire). A product
without a key still lists its tools; their calls answer `not_logged_in` until a key is
stored, without restarting the server. With several workspaces in a product, set
`defaultWorkspace` in the config file so its tools know which one to use.

## Environment

| Variable | Meaning |
|---|---|
| `MAGIC_<PRODUCT>_KEY` | the product's key, e.g. `MAGIC_PYRAMID_KEY=pyramid_…`; never stored, wins over the sign-in |
| `MAGIC_<PRODUCT>_URL` | the product's API base URL, e.g. `MAGIC_PYRAMID_URL`, `MAGIC_SITES_URL`, `MAGIC_MARKETING_URL` |
| `MAGIC_ACCOUNT_URL` | the Account to sign in with, default `https://account.magicspells.io` |
| `MAGIC_ACCOUNT_CLIENT_ID` | the `magic` application's client id at that Account |
| `MAGIC_ALLOW_DESTRUCTIVE=1` | allow destructive operations (with `--yes`, or `yes: true` in MCP) |
| `MAGIC_CREDENTIALS_FILE=1` | store keys in the 0600 file instead of the OS keychain |
| `XDG_CONFIG_HOME` | where `magic/` (config and credentials file) lives |
| `NO_COLOR` | no colour |

## Exit codes

Scripts branch on the exit code, or on `error.code` in the JSON envelope: 0 ok, 1 unknown,
2 usage, 3 not logged in, bad or expired key, or sign-in cancelled, 4 permission denied, 5 not found, 6 ambiguous name,
7 validation or conflict, 8 destructive action disabled, 9 rate limited, 10 network,
11 product unavailable. The table lives in
[`packages/kit/src/errors.ts`](https://github.com/magic-spells/cli/blob/main/packages/kit/src/errors.ts)
(`exitCodeFor`).

MIT licensed.
