import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// One root `npm test`, one vitest project per workspace so results report per package.
// Workspace imports resolve to TypeScript source, so tests never need a prior build.
const src = (pkg: string): string =>
	fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			'@magic-spells/kit': src('kit'),
			'@magic-spells/pyramid': src('pyramid'),
		},
	},
	test: {
		environment: 'node',
		globals: false,
		projects: ['kit', 'pyramid', 'cli'].map((name) => ({
			extends: true as const,
			test: { name, root: `packages/${name}`, include: ['tests/**/*.test.ts'] },
		})),
	},
});
