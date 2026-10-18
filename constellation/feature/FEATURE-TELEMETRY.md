---
name: 'Telemetry with consent: first-run prompt, magic telemetry on|off|status, CI and DO_NOT_TRACK honoured'
status: planned
release: RELEASE-4-MARKETING-TELEMETRY-UPGRADE
change: feature
connections:
  - COMPONENT-TELEMETRY
  - DOC-SECURITY
  - DOC-OPEN-DECISIONS
---

# Telemetry

## Scope

- [[COMPONENT-TELEMETRY]]: consent state in config, the one-time prompt, the detached sender, `magic telemetry on|off|status`.
- An ingest endpoint (where it lives is part of the open telemetry row in [[DOC-OPEN-DECISIONS]]).
- A public page listing every field sent.

## Acceptance

- A fresh install sends nothing until the prompt is answered "yes".
- `CI=1`, `MAGIC_TELEMETRY=0` or `DO_NOT_TRACK=1` each prevent the prompt and any send.
- No event contains an argument value, a path, a workspace handle or a key (a test inspects payloads).
