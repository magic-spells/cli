// Unit tests for getVersion (FILE-VERSION) — it must find the real package.json
// version regardless of layout, not fall back to "0.0.0".

import { readFileSync } from 'node:fs';

import { describe, it, expect } from 'vitest';

import { getVersion } from '../src/version.js';

describe('getVersion', () => {
	it('returns a semver-shaped version, not the 0.0.0 fallback', () => {
		const v = getVersion();
		expect(v).toMatch(/^\d+\.\d+\.\d+/);
		expect(v).not.toBe('0.0.0');
	});

	it('matches the package.json version', () => {
		const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
			version: string;
		};
		expect(getVersion()).toBe(pkg.version);
	});
});
