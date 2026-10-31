---
name: Post-MVP roadmap (v2+)
status: planned
connections:
  - PLAN-PROJECT
---

# Post-MVP roadmap (v2+)

Explicitly out of scope for the first ship; recorded so the architecture does not foreclose them.

- **Short-lived browser-login code exchange / OAuth** — the MVP browser handoff is built with a loopback `pyk_` key delivery. A later code-exchange or OAuth refresh-token flow can remove the secret from the callback URL and support richer revocation without changing local keychain reads ([[DOC-CREDENTIAL-STORAGE]], [[FLOW-CLI-BROWSER-LOGIN]]).
- **Streaming tool outputs** — progressive results for long lists via the MCP streaming spec.
- **Webhook / SSE push** — surface changes to followed tasks as MCP notifications once the backend event stream is ready.
- **Local search index** — SQLite cache of recent tasks for offline / fast-prefix search. This would break the current stateless app-data property, so it needs an explicit storage/privacy decision.
- **Remote-hosted variant** — same tool surface over HTTP/SSE; needs server multi-tenancy.
- **Programmatic SDK export** — the core (`PyramidClient`, the resolver, the operation registry [[FILE-OPERATIONS]]) is already SDK-shaped and used internally by both surfaces. Expose it publicly via an `exports` map + a small `createPyramid(config)` facade when a Node/TS consumer appears. Additive and non-breaking; deferred to keep the public surface to CLI + MCP for now ([[DOC-PACKAGE-RENAME]]).
