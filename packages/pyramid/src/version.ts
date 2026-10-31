// FILE-VERSION — the package version, read once, robust to BOTH the compiled
// dist layout AND running the TypeScript directly via tsx. Used by the CLI
// `version` command, the MCP `serverInfo`, and the MCP instructions, so the CLI
// and MCP always report the same number.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let cached: string | undefined;

/**
 * The package.json `version` (e.g. "0.1.0"), or "0.0.0" if it can't be found.
 * Walks up from this module's directory to the first package.json — which is the
 * package root whether we're at `src/version.ts` (tsx) or `dist/src/version.js`
 * (compiled), so it never depends on a fixed number of "../".
 */
export function getVersion(): string {
	if (cached !== undefined) return cached;
	let dir = dirname(fileURLToPath(import.meta.url));
	for (let i = 0; i < 8; i++) {
		try {
			const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
				version?: string;
			};
			if (typeof pkg.version === 'string') {
				cached = pkg.version;
				return cached;
			}
		} catch {
			// No package.json here — keep climbing.
		}
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	cached = '0.0.0';
	return cached;
}
