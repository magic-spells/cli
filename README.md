# Magic CLI

One command line and MCP server for Magic Spells' hosted services: `magic`. Usage, commands,
environment and exit codes: [packages/cli/README.md](packages/cli/README.md) (the npm page).

```sh
npx -y magic-spells --help
claude mcp add magic -- npx -y magic-spells mcp
```

## Develop

Node 24 (`nvm use`). npm workspaces: `packages/cli` (the `magic` shell, the only published
package), `packages/kit` (the shared core, including the Account client and product
sessions), `packages/pyramid` (the Pyramid product), `packages/sites` and
`packages/marketing` (sign-in only until their commands arrive).

```sh
npm install
npm run build          # tsc -b across the workspaces
npm run typecheck      # sources and tests
npm test               # vitest, one project per package
npm run smoke:pack     # pack, install the tarball in an empty dir, run it
node packages/cli/bin/magic.js --help
```

Cory publishes from his machine: `npm run build && npm publish -w packages/cli --access public`,
then pushes the matching `v*` tag. The tag runs `.github/workflows/release.yml`, which builds,
tests, and installs the published version on each OS; it never publishes and holds no npm token.
`prepack` bundles the private workspace packages into `packages/cli/dist` with esbuild, and
third-party packages stay external as `magic-spells`'s dependencies.

MIT licensed.
