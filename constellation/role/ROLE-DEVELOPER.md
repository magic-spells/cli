---
name: 'Developer: builds themes, apps or integrations from a terminal'
status: planned
issued_by: 'Each product: a workspace membership whose role allows the commands used'
permissions:
  - sites:themes
  - sites:content
  - apps:publish
  - pyramid:tasks
connections:
  - DECISION-ONE-CLI-FOR-HOSTED-SERVICES
  - COMPONENT-APP-PACKAGE
  - FEATURE-APP-COMMANDS
  - FLOW-LOGIN-DEVICE
  - FLOW-RUN-OPERATION
---

# Developer

A person working in a terminal: theme development (`magic sites dev | check | theme push`), app development (`magic app …`), tracking work (`magic pyramid task next`), scripting in CI with product or app keys.

- Logs in once with `magic login`; what each command may do is decided by their role in that product's workspace.
- Uses `--json` in scripts and relies on the exit table.
