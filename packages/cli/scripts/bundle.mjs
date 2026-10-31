// The published build (FEATURE-RELEASE-PIPELINE): esbuild bundles src/main.ts with
// the private workspace packages (@magic-spells/kit and every product) inlined,
// into dist/. Third-party packages stay external and are this package's declared
// dependencies, so the tarball installs them like any other package.
//
// Runs as `prepack`, so `npm pack` and `npm publish` always ship the bundle. It
// empties dist/ first (dropping tsc's output and .tsbuildinfo); the next
// `npm run build` re-emits the tsc output for development.

import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const pkg = JSON.parse(readFileSync(here('../package.json'), 'utf8'));
const external = Object.keys(pkg.dependencies ?? {});

// Every private workspace package is inlined from its TypeScript source, so the
// bundle never depends on a stale tsc build of a sibling.
const alias = {};
for (const dir of readdirSync(here('../..'))) {
	const file = here(`../../${dir}/package.json`);
	if (!existsSync(file)) continue;
	const sibling = JSON.parse(readFileSync(file, 'utf8'));
	if (sibling.private) alias[sibling.name] = here(`../../${dir}/src/index.ts`);
}

rmSync(here('../dist'), { recursive: true, force: true });
await build({
	entryPoints: [here('../src/main.ts')],
	outdir: here('../dist'),
	bundle: true,
	// Product modules stay lazy: each loads as its own chunk on first use.
	splitting: true,
	format: 'esm',
	platform: 'node',
	target: 'node24',
	external,
	alias,
	sourcemap: false,
	legalComments: 'none',
	logLevel: 'warning',
});
