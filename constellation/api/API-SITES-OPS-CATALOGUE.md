---
name: 'Sites ops catalogue: `sites ops --json` and the raw `--input` mode (a binary interface, not HTTP)'
status: planned
connections:
  - DECISION-SITES-VIA-BINARY-ADAPTER
  - COMPONENT-SITES-ADAPTER
  - FEATURE-SITES-ENGINE-CHANGES
  - FLOW-SITES-ADAPTER-BOOT
  - EXTERNAL-SITES
---

# Sites ops catalogue

**Lands in:** sites/engine (`cmd/sites/cli.go`, reading `ops/builtin` and `ops/schema.go`)

A process interface of the `sites` binary, recorded here as the adapter's contract. It also gives the hand-written DOC-CLI-REFERENCE (sites engine plan) a generated source.

## `sites ops --json`

- Auth: none (reads the compiled registry).
- stdout:

```json
{
  "engine_version": "0.3.0",
  "catalogue_version": 1,
  "operations": [
    {
      "name": "theme.push",
      "summary": "…",
      "detail": "…",
      "surfaces": ["cli", "mcp"],
      "destructive": false,
      "requires_session": true,
      "input_schema": { "type": "object", "properties": { … }, "required": [ … ] },
      "cli": { "subject": "theme" }
    }
  ]
}
```

- `destructive` and `requires_session` are new fields the registry must carry (today only `Surfaces` exists).

## `sites <op> --input '<json>'` (and `--input -` for stdin)

- Runs one operation with a JSON object validated against `input_schema`, bypassing flag parsing. stdout: the result as JSON; on failure stderr `{"error":{"code","message","hint"}}` and exit 1 or 2 as today.

## Per-call credentials

- `SITES_TOKEN` (a `pk_`) is honoured by every operation at call time when set, ahead of the keychain; `SITES_API` sets the host. When `SITES_TOKEN` is set the binary never reads or writes `dev.sites.cli`.
