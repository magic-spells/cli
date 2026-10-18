---
name: 'Telemetry: consent prompt on first run, off until answered, magic telemetry on|off'
kind: library
status: planned
framework: typescript
connections:
  - FEATURE-TELEMETRY
  - DATATYPE-CLI-CONFIG
  - DOC-SECURITY
  - DOC-OPEN-DECISIONS
---

# Telemetry

No product in the family collects CLI telemetry today (research §5.6).

- State in the config file: `telemetry: "unset" | "on" | "off"`. `unset` sends nothing.
- First interactive run (TTY on stdin and stderr, not `CI`, not `magic mcp`) asks once; the answer is stored.
- `MAGIC_TELEMETRY=0` and `CI` force off; `DO_NOT_TRACK=1` is honoured.
- Events are batched and sent after the command in a detached process; a send failure is silent.
- Fields: command name (never argument values), product, exit code, duration, CLI version, OS/arch, Node version, an anonymous install id. Final list is open ([[DOC-OPEN-DECISIONS]]).
