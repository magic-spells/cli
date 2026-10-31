# Magic CLI

One command line and MCP server for Magic Spells' hosted services: `magic`.

```sh
npx -y @magic-spells/cli --help
npx -y @magic-spells/cli pyramid task next
```

Register the MCP server with an agent client:

```sh
claude mcp add magic -- npx -y @magic-spells/cli mcp
```

## Develop

Node 24 (`nvm use`). npm workspaces: `packages/cli` (the `magic` shell, the only published
package), `packages/kit` (the shared core), `packages/pyramid` (the Pyramid product).

```sh
npm install
npm run build          # tsc -b across the workspaces
npm test               # vitest, one project per package
node packages/cli/bin/magic.js --help
```

MIT licensed.
