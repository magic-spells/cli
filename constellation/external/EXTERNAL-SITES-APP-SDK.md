---
name: 'Sites App SDK: the app framework whose developer commands become magic sites app'
kind: external-microservice
status: planned
vendor: Magic Spells
purpose: >-
  Defines the app developer commands, manifest validator and reference app that magic sites app
  drives
connections:
  - COMPONENT-APP-PACKAGE
  - FEATURE-APP-COMMANDS
  - DIAGRAM-ARCHITECTURE
---

# Sites App SDK

Repo `sites-app-sdk` (renamed from AppKit 2026-10-18; npm `@magic-spells/app-sdk`, Go module `sites-app-sdk`). Its plan owns the command semantics (COMPONENT-SITES-APP-CLI, FLOW-DEVELOPER-INIT-TO-PUBLISH, DATATYPE-APP-KEY there) and spells the commands `magic sites app …`, as this plan does. Server-side work for those commands lands in Sites.
