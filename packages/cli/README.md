# magic-spells

`magic`: one command line and MCP server for Magic Spells' hosted services. Node 24 or newer.

```sh
npx -y magic-spells --help      # or: npm i -g magic-spells
```

## Sign in with a product key

```sh
magic login --product-key            # paste the key at the hidden prompt
echo "$KEY" | magic login --product-key pyramid   # or pipe it (CI)
magic whoami                         # where each key comes from, and who it is
magic logout                         # forget every stored key (--product <p> for one)
```

Keys are read from the prompt or stdin, never from arguments, and stored in the macOS
Keychain (service `io.magicspells.cli`) or, elsewhere, a mode-0600 file in
`~/.config/magic/credentials.json`. A key in the environment wins over a stored one.
`magic pyramid login` is the browser sign-in that mints a Pyramid key for you.

## Commands

| Command | Does |
|---|---|
| `magic login --product-key [<product>]` | store a product key (product detected from the key's prefix) |
| `magic logout [--product <p>]` | forget stored keys |
| `magic whoami [--json]` | per product: key source (env, keychain, file, none), masked key, identity |
| `magic doctor [--json]` | Node, credential store, and per product: API reachable, key present, product checks |
| `magic mcp [--products a,b]` | the MCP server over stdio: every product's tools, prefixed (`pyramid_*`) |
| `magic pyramid <noun> <verb>` | Pyramid: `task next`, `task move WEB-42 --status "In Review"`, `task comment`, `project list`, `whoami`, … (`magic pyramid --help`) |

Global flags: `--json`, `--yes/-y`, `--no-color`, `--quiet/-q`, `--workspace <handle>`.
Output is JSON whenever stdout is not a terminal; errors go to stderr as
`{ "error": { "code", "message", "hint", "product" } }`.

## MCP

```sh
claude mcp add magic -- npx -y magic-spells mcp
```

A product without a key still lists its tools; their calls answer `not_logged_in` until a
key is stored, without restarting the server.

## Environment

| Variable | Meaning |
|---|---|
| `MAGIC_<PRODUCT>_KEY` | the product's key, e.g. `MAGIC_PYRAMID_KEY=pyramid_…`; never stored |
| `MAGIC_<PRODUCT>_URL` | the product's API base URL, e.g. `MAGIC_PYRAMID_URL` |
| `MAGIC_ALLOW_DESTRUCTIVE=1` | allow destructive operations (with `--yes`, or `yes: true` in MCP) |
| `MAGIC_CREDENTIALS_FILE=1` | store keys in the 0600 file instead of the OS keychain |
| `XDG_CONFIG_HOME` | where `magic/` (config and credentials file) lives |
| `NO_COLOR` | no colour |

## Exit codes

Scripts branch on the exit code, or on `error.code` in the JSON envelope: 0 ok, 1 unknown,
2 usage, 3 not logged in or bad key, 4 permission denied, 5 not found, 6 ambiguous name,
7 validation or conflict, 8 destructive action disabled, 9 rate limited, 10 network,
11 product unavailable. The table lives in
[`packages/kit/src/errors.ts`](https://github.com/magic-spells/cli/blob/main/packages/kit/src/errors.ts)
(`exitCodeFor`).

MIT licensed.
