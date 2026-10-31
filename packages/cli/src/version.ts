// The CLI's version: the `version` of packages/cli/package.json, found by walking up
// from this module, which works from src (vitest), dist (tsc) and the bundle.

import { readPackageVersion } from '@magic-spells/kit';

let cached: string | undefined;

export function version(): string {
	return (cached ??= readPackageVersion(import.meta.url));
}
