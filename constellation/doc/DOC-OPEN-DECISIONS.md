---
name: 'Open decisions waiting on Cory'
kind: meta
status: planned
connections:
  - DECISION-ONE-MCP-SERVER
  - DECISION-KEYRING-DEFAULT
  - DECISION-ACCOUNT-IDENTITY-PRODUCT-AUTHORITY
  - DECISION-PUBLIC-NPM-RELEASE-ON-TAG
  - DECISION-NOT-FOR-FRAMEWORKS
  - DECISION-SITES-VIA-BINARY-ADAPTER
  - COMPONENT-TELEMETRY
  - FEATURE-TELEMETRY
  - FEATURE-KEYRING
  - FEATURE-DEVICE-LOGIN
  - RELEASE-4-MARKETING-TELEMETRY-UPGRADE
---

# Open decisions

From MAGIC-CLI-BRIEF §10, plus three rows found while writing the plan (marked *new*). Each row: the options and the plan's recommendation. Nothing here blocks R0 except row 9.

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | Hosted HTTP MCP with OAuth | (a) local stdio `magic mcp` only; (b) also a hosted Streamable HTTP server with OAuth per client, for API-only operations | (a) now. Revisit after R2 if people want agents in web clients without Node; it would need Account OAuth for third-party clients, a bigger change than the `cli` kind. |
| 2 | Docs site location | (a) `magicspells.io/docs/cli`; (b) a `cli.magicspells.io` subdomain; (c) README + generated reference in the repo only | (a), generated from the registries (`--help` text and schemas), in R4. Until then (c). |
| 3 | Telemetry fields and destination | Fields: command name, product, exit code, duration, CLI version, OS/arch, Node version, anonymous install id — plus or minus error code, `--json` use, install method. Destination: (a) an endpoint on an existing service; (b) a small dedicated ingest service | The listed fields plus error code and install method; nothing user-supplied. (b) a small ingest service writing to an analytics store, so no product API carries it. |
| 4 | Operator tools in `magic` (`sites-internal`, `accountctl`, `mspm`) behind an operator login | (a) no — separate private binaries; (b) a hidden `magic ops …` namespace gated by an operator role | (a). They talk to databases directly or sit behind an access gateway by design; a public package should not carry them. |
| 5 | Keyring library | (a) a maintained N-API binding with prebuilt binaries for Node 24 on all platforms; (b) shell out per OS (`security`, `secret-tool`, PowerShell) | (a), chosen in R1 by: prebuilds for darwin/linux/win32 × x64/arm64 on Node 24, active maintenance, no postinstall compile. (b) only as the fallback before the file. |
| 6 | Loopback login in R1, or device flow alone | (a) both in R1; (b) device in R1, loopback later | (a). The Account change is one feature either way, and loopback is the smoother desktop path; device stays the default under SSH. |
| 7 | Version policy as products add commands at different cadences | (a) one CLI version, product packages unversioned; (b) per-product versions with a compatibility matrix | (a). Any product change ships in the next `magic` release; engine packages pinned to it. |
| 8 | Linux/Windows CI runners for keyring tests | (a) GitHub-hosted ubuntu + windows runners with a Secret Service under dbus; (b) macOS only, others manual | (a), from R1. |
| 9 | *new* `--product-key` in argv | The brief lists `--product-key` as a global escape hatch; pyramid-cli's rule is "PYRAMID_API_KEY is env-only — never a flag (keeps keys out of argv/history)" | Keep the flag but never take the key as its value: prompt (hidden) or stdin with `-`. Recorded in [[DOC-SECURITY]]; confirm. |
| 10 | *new* Publishing the Sites engine binary publicly | The Sites repo is private; R2 publishes its compiled binary to public npm under a CLI that is MIT | Publish the binary under a separate proprietary licence file in each engine package (source stays private); confirm before R2. |
| 11 | *new* Engine packages vs "the only published package" | Ruling 1 says `@magic-spells/cli` is the only published package; ruling 4 publishes `@magic-spells/sites-engine-<os>-<arch>` | Read ruling 1 as "the only package people install"; the engine packages are published as install-time artefacts, never installed directly. |
