// Unit tests for loadConfig (src/config.ts) — pure, no network.
//
// loadConfig reads a PyramidConfig out of an injected env. It must:
//   - throw a PLAIN Error (clear, one-line message) on a missing/blank key,
//   - throw a PLAIN Error when the key does not start with "pyk_",
//   - default baseUrl to the production host,
//   - parse PYRAMID_ALLOW_DESTRUCTIVE === "1" -> true (anything else -> false).
//
// We pass an explicit env object every time so process.env never leaks in.

import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

const DEFAULT_BASE_URL = 'https://api.pyramid.magicspells.io';
const VALID_KEY = 'pyk_abc123_secretvalue';

/** Build a minimal env, overridable per test. Typed as NodeJS.ProcessEnv. */
function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
	return overrides as NodeJS.ProcessEnv;
}

describe('loadConfig', () => {
	it('returns a config for a valid key with all defaults applied', () => {
		const cfg = loadConfig(env({ PYRAMID_API_KEY: VALID_KEY }));
		expect(cfg.apiKey).toBe(VALID_KEY);
		expect(cfg.baseUrl).toBe(DEFAULT_BASE_URL);
		expect(cfg.allowDestructive).toBe(false);
	});

	it('throws a plain Error (not McpError) when PYRAMID_API_KEY is missing', () => {
		let thrown: unknown;
		try {
			loadConfig(env({}), () => null);
		} catch (e) {
			thrown = e;
		}
		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as Error).name).toBe('Error');
		expect((thrown as Error).message).toMatch(/PYRAMID_API_KEY/);
		expect((thrown as Error).message).toContain('pyramid set-key <pyk_...>');
		expect((thrown as Error).message).not.toContain('pyramid auth login');
	});

	it('throws when PYRAMID_API_KEY is an empty string', () => {
		expect(() => loadConfig(env({ PYRAMID_API_KEY: '' }), () => null)).toThrow(/PYRAMID_API_KEY/);
	});

	it('throws when PYRAMID_API_KEY is blank/whitespace only', () => {
		expect(() => loadConfig(env({ PYRAMID_API_KEY: '   ' }), () => null)).toThrow(
			/PYRAMID_API_KEY/
		);
	});

	it('throws when the key does not start with "pyk_"', () => {
		let thrown: unknown;
		try {
			loadConfig(env({ PYRAMID_API_KEY: 'sk_live_nope' }));
		} catch (e) {
			thrown = e;
		}
		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as Error).message).toMatch(/pyk_/);
	});

	it('does not leak the API key in the thrown error message', () => {
		// Even when a key IS supplied but invalid (no prefix), the secret must not
		// appear in the surfaced message.
		const secret = 'sk_live_TOPSECRET_do_not_log';
		let thrown: unknown;
		try {
			loadConfig(env({ PYRAMID_API_KEY: secret }));
		} catch (e) {
			thrown = e;
		}
		expect((thrown as Error).message).not.toContain(secret);
	});

	it('uses PYRAMID_BASE_URL when provided', () => {
		const cfg = loadConfig(
			env({ PYRAMID_API_KEY: VALID_KEY, PYRAMID_BASE_URL: 'https://staging.example.com' })
		);
		expect(cfg.baseUrl).toBe('https://staging.example.com');
	});

	it('trims a single trailing slash from the base URL', () => {
		const cfg = loadConfig(
			env({ PYRAMID_API_KEY: VALID_KEY, PYRAMID_BASE_URL: 'https://staging.example.com/' })
		);
		expect(cfg.baseUrl).toBe('https://staging.example.com');
	});

	it('preserves a base path verbatim (only the single trailing slash is trimmed)', () => {
		const cfg = loadConfig(
			env({ PYRAMID_API_KEY: VALID_KEY, PYRAMID_BASE_URL: 'https://example.com/api/v2/' })
		);
		expect(cfg.baseUrl).toBe('https://example.com/api/v2');
	});

	it('throws a plain Error when PYRAMID_BASE_URL is not a valid URL', () => {
		let thrown: unknown;
		try {
			loadConfig(env({ PYRAMID_API_KEY: VALID_KEY, PYRAMID_BASE_URL: 'not a url' }));
		} catch (e) {
			thrown = e;
		}
		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as Error).name).toBe('Error');
		expect((thrown as Error).message).toMatch(/PYRAMID_BASE_URL/);
	});

	it('parses PYRAMID_ALLOW_DESTRUCTIVE === "1" as true', () => {
		const cfg = loadConfig(env({ PYRAMID_API_KEY: VALID_KEY, PYRAMID_ALLOW_DESTRUCTIVE: '1' }));
		expect(cfg.allowDestructive).toBe(true);
	});

	it('treats any non-"1" PYRAMID_ALLOW_DESTRUCTIVE value as false', () => {
		for (const v of ['0', 'true', 'yes', 'on', '', '11', ' 1 ']) {
			const cfg = loadConfig(env({ PYRAMID_API_KEY: VALID_KEY, PYRAMID_ALLOW_DESTRUCTIVE: v }));
			expect(cfg.allowDestructive).toBe(false);
		}
	});
});
