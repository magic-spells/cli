---
name: CliGlobalOptions
status: built
connections:
  - DATATYPE-MCP-CONFIG
  - DOC-CLI
  - DOC-CLI-OUTPUT
---

Global flags parsed before the subcommand and layered over startup config ([[DATATYPE-MCP-CONFIG]]) — flags win where a flag exists.

```ts
interface CliGlobalOptions {
  json: boolean;        // --json — force machine output (else: JSON when stdout is not a TTY)
  project?: string;     // --project — default project name/key for verbs that take one
  baseUrl?: string;     // --base-url — overrides PYRAMID_BASE_URL
  yes: boolean;         // --yes / -y — skip the destructive confirm prompt
  color?: boolean;      // --no-color — disable ANSI (also honors the NO_COLOR env var)
  quiet: boolean;       // --quiet / -q — suppress non-error stderr chatter
  noCache?: boolean;    // --no-cache — bypass resolver cache for debug/refresh paths
}
```

`PYRAMID_API_KEY` is never a CLI flag, to keep keys out of shell history and process argv. Provide it through env or store it locally with `pyramid set-key <pyk_...>` ([[DOC-CREDENTIAL-STORAGE]]). Output behavior driven by these flags is specified in [[DOC-CLI-OUTPUT]].
