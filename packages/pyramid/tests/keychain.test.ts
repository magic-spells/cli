// Unit tests for the `env -> keychain -> error` resolution in loadConfig
// (FLOW-CREDENTIAL-RESOLUTION). The keychain reader is INJECTED, so no real
// keychain / `security` call ever happens here.

import { describe, it, expect, vi } from 'vitest';

import { loadConfig } from '../src/config.js';

const KEY = 'pyk_abc123_secretvalue';

function env(o: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
	return o as NodeJS.ProcessEnv;
}

describe('credential resolution (env -> keychain -> error)', () => {
	it('uses the env key and does NOT consult the keychain', () => {
		const read = vi.fn(() => 'pyk_fromkeychain_should_not_win');
		const cfg = loadConfig(env({ PYRAMID_API_KEY: KEY }), read);
		expect(cfg.apiKey).toBe(KEY);
		expect(read).not.toHaveBeenCalled();
	});

	it('falls back to the keychain when env is unset', () => {
		const read = vi.fn(() => KEY);
		const cfg = loadConfig(env({}), read);
		expect(cfg.apiKey).toBe(KEY);
		expect(read).toHaveBeenCalledOnce();
	});

	it('falls back to the keychain when env is blank/whitespace', () => {
		const cfg = loadConfig(env({ PYRAMID_API_KEY: '   ' }), () => KEY);
		expect(cfg.apiKey).toBe(KEY);
	});

	it('throws when neither env nor keychain has a key', () => {
		expect(() => loadConfig(env({}), () => null)).toThrow(/PYRAMID_API_KEY/);
	});

	it('validates the pyk_ prefix on a keychain-sourced key too', () => {
		expect(() => loadConfig(env({}), () => 'sk_live_nope')).toThrow(/pyk_/);
	});

	it('does not leak a keychain-sourced secret in the error message', () => {
		const secret = 'sk_live_TOPSECRET_keychain';
		let msg = '';
		try {
			loadConfig(env({}), () => secret);
		} catch (e) {
			msg = (e as Error).message;
		}
		expect(msg).not.toContain(secret);
	});
});
