// Package version lookup, robust to both the compiled dist layout and running source
// under vitest: walk up from a module URL to the first package.json with a version.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The `version` of the nearest package.json above `moduleUrl`, or "0.0.0". */
export function readPackageVersion(moduleUrl: string): string {
	let dir = dirname(fileURLToPath(moduleUrl));
	for (let i = 0; i < 8; i++) {
		try {
			const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
				version?: unknown;
			};
			if (typeof pkg.version === 'string') return pkg.version;
		} catch {
			// No package.json here; keep climbing.
		}
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return '0.0.0';
}
