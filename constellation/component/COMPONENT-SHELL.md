---
name: 'Shell (packages/cli): the `magic` bin, global flags, product dispatch, login/logout/whoami/doctor/mcp/upgrade/telemetry'
kind: cli
status: built
framework: typescript
connections:
  - COMPONENT-KIT
  - COMPONENT-OPERATION-REGISTRY
  - COMPONENT-LOGIN
  - COMPONENT-MCP-AGGREGATOR
  - COMPONENT-RENDER
  - COMPONENT-UPGRADE
  - COMPONENT-TELEMETRY
  - COMPONENT-PYRAMID-PACKAGE
  - COMPONENT-SITES-ADAPTER
  - COMPONENT-APP-PACKAGE
  - COMPONENT-MARKETING-PACKAGE
  - DATATYPE-CLI-CONFIG
  - DOC-COMMAND-TREE
  - FLOW-RUN-OPERATION
  - FEATURE-MONOREPO-SCAFFOLD
  - FEATURE-WHOAMI-DOCTOR
notes:
  - kind: state
    text: >-
      Built so far (packages/cli): bin/magic.js (plain JS Node >=24 check, then dist/main.js),
      `magic version|--version`, `magic --help` (top level + products), lazy product dispatch
      through src/products.ts (pyramid only) into the kit's runProductCli, exit codes via
      process.exitCode. Global flags are parsed by the kit (--json --yes/-y --no-color/NO_COLOR
      --quiet/-q --no-cache --workspace). Not built: login/logout/whoami/doctor
      (FEATURE-WHOAMI-DOCTOR), mcp (FEATURE-MCP-AGGREGATOR), --product-key, upgrade, telemetry,
      SIGINT -> OpContext.signal.
    sha: 0304bf4
  - kind: state
    text: >-
      Now built: top-level `login --product-key`, `logout`, `whoami`, `doctor`, `mcp`
      (packages/cli/src/commands/*, a Shell context in src/shell.ts), every top-level error through
      the kit's renderError (JSON envelope when piped). `--no-cache` was removed (it did nothing);
      `--workspace` is a usage error wherever no operation input takes it, including top-level
      commands. Still not built: upgrade, telemetry, SIGINT → OpContext.signal for CLI runs (it is
      wired for `magic mcp`). The published bin runs the esbuild bundle that `prepack` writes into
      dist/.
    sha: '2952966'
  - kind: state
    text: >-
      2026-10-31: shipped in magic-spells 0.1.0, with full Account `login`/`logout` and `magic
      sites` / `magic marketing` sign-in-only namespaces added in 0.2.0 (0.2.1: zod 4). `upgrade`,
      `telemetry` and their start-up checks are not built; they ship with COMPONENT-UPGRADE /
      COMPONENT-TELEMETRY in R4.
---

# Shell

`packages/cli` is the only package with a `bin` entry (`magic`) and the only one npm publishes. It owns process concerns and nothing product-specific. Modelled on pyramid-cli's `bin/pyramid.ts` (version, dispatch, signal handling, exit codes, one-line diagnostics on stderr) and `src/cli/index.ts`.

## Responsibilities


- **Global flags**, parsed anywhere in argv (pyramid-cli's `parseGlobals`): `--json`, `--yes/-y`, `--no-color` (and `NO_COLOR`), `--quiet/-q`, `--workspace <handle>`, `--product-key` (reads the key from a prompt or stdin, never from the argv value — see [[DOC-SECURITY]]), `--version`, `--help`.
- **Top-level commands:** `login`, `logout`, `whoami`, `doctor`, `mcp`, `upgrade`, `telemetry on|off|status`, `version`.
- **Product dispatch:** the first token that names a product loads that product's registry ([[COMPONENT-OPERATION-REGISTRY]]) lazily, so `magic pyramid …` never spawns the Sites engine.
- **Help:** `magic --help` lists top-level commands and products; `magic <product> --help` lists nouns and verbs derived from the registry.
- **Exit:** maps the error envelope to the exit table ([[DECISION-OPERATION-CONTRACT]]); usage errors exit 2.
- **Start-up checks:** Node ≥ 24, else one line and exit 1; the update notice from cache ([[COMPONENT-UPGRADE]]); the telemetry consent prompt on first interactive run ([[COMPONENT-TELEMETRY]]).

## Rules

- No business logic: everything behind a product token is an operation.
- `magic mcp` hands stdout to the MCP transport before any other output.
