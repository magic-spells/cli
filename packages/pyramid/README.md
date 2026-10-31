# @magic-spells/pyramid (workspace package)

The Pyramid product inside the Magic CLI: `magic pyramid …` and the `pyramid_*` MCP
tools. Private; ships inside `magic-spells`, never on its own. Moved here from
`magic-spells/pyramid-cli` with its history (git subtree).

```sh
magic login                          # once: signs in and mints a pyk_ key per workspace
magic pyramid task next
magic pyramid task move WEB-42 --status "In Review"
magic pyramid task comment WEB-42 "Looks good"
magic pyramid project list
magic pyramid whoami
```

With more than one Pyramid workspace, pick one with `--workspace <handle>` (or set
`defaultWorkspace.pyramid` in `~/.config/magic/config.json`). In CI, set
`MAGIC_PYRAMID_KEY` instead (Pyramid → Settings → API Keys).

| Variable | Meaning |
|---|---|
| `MAGIC_PYRAMID_KEY` | `pyk_` key (was `PYRAMID_API_KEY`) |
| `MAGIC_PYRAMID_URL` | API base URL, default `https://api.pyramid.magicspells.io` (was `PYRAMID_BASE_URL`) |
| `MAGIC_ALLOW_DESTRUCTIVE=1` | with `--yes`, allows `task delete` (was `PYRAMID_ALLOW_DESTRUCTIVE`) |

Layout: `src/operations` (the registry), `src/client` (HTTP), `src/cache/resolver.ts`
(names to ids), `src/hydrate.ts` (ids to names), `src/mcp` (instructions, resources,
prompts), `src/doctor.ts`, `src/index.ts` (the ProductModule).
