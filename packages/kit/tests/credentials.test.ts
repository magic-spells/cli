// Credential resolution env -> store -> not_logged_in, and the pasted-key helpers
// (from pyramid-cli's keychain/config/auth-commands tests, generalised).

import { describe, expect, it, vi } from 'vitest';

import {
	forgetProductKey,
	manualItem,
	maskKey,
	parseStoredSession,
	resolveCredential,
	saveProductKey,
} from '../src/credentials.js';
import { isMagicError } from '../src/errors.js';
import { DEMO_KEY, demoProduct, memoryStore } from './helpers.js';

describe('resolveCredential', () => {
	it('uses the env key and does NOT consult the store', async () => {
		const store = memoryStore();
		const get = vi.spyOn(store, 'get');
		const s = await resolveCredential(demoProduct, { env: { MAGIC_DEMO_KEY: DEMO_KEY }, store });
		expect(s).toEqual({ product: 'demo', key: DEMO_KEY, source: 'env' });
		expect(get).not.toHaveBeenCalled();
	});

	it('falls back to the store when env is unset or blank', async () => {
		const store = memoryStore({
			[manualItem('demo')]: JSON.stringify({ key: DEMO_KEY, source: 'manual' }),
		});
		for (const env of [{}, { MAGIC_DEMO_KEY: '   ' }]) {
			expect((await resolveCredential(demoProduct, { env, store })).key).toBe(DEMO_KEY);
		}
	});

	it('throws not_logged_in when neither has a key', async () => {
		const err = await resolveCredential(demoProduct, { env: {}, store: memoryStore() }).catch(
			(e) => e
		);
		expect(isMagicError(err) && err.code).toBe('not_logged_in');
		expect(err.hint).toMatch(/MAGIC_DEMO_KEY/);
		expect(err.hint).toMatch(/magic login --product-key/);
	});

	it('validates the prefix on a stored key too, without leaking it', async () => {
		const store = memoryStore({
			[manualItem('demo')]: JSON.stringify({ key: 'sk_live_TOPSECRET' }),
		});
		const err = await resolveCredential(demoProduct, { env: {}, store }).catch((e) => e);
		expect(err.code).toBe('auth_invalid');
		expect(err.message).not.toContain('TOPSECRET');
		expect(err.message).toContain('dmk_');
	});
});

describe('pasted keys', () => {
	it('saveProductKey stores a manual session; forgetProductKey removes it', async () => {
		const store = memoryStore();
		await saveProductKey(demoProduct, store, ` ${DEMO_KEY} `);
		expect(JSON.parse(store.items[manualItem('demo')]!)).toEqual({
			product: 'demo',
			key: DEMO_KEY,
			source: 'manual',
		});
		await forgetProductKey(demoProduct, store);
		await forgetProductKey(demoProduct, store);
		expect(store.items).toEqual({});
	});

	it('saveProductKey refuses a wrong prefix and stores nothing', async () => {
		const store = memoryStore();
		await expect(saveProductKey(demoProduct, store, 'sk_nope')).rejects.toMatchObject({
			code: 'auth_invalid',
		});
		expect(store.items).toEqual({});
	});

	it('parseStoredSession tolerates a bare key', () => {
		expect(parseStoredSession('demo', DEMO_KEY)).toEqual({
			product: 'demo',
			key: DEMO_KEY,
			source: 'manual',
		});
		expect(parseStoredSession('demo', '')).toBeNull();
	});
});

describe('maskKey', () => {
	it('keeps the prefix, hides the secret, shows the last 4', () => {
		expect(maskKey('dmk_abc123_secretvalue', 'dmk_')).toBe('dmk_abc123_…alue');
	});
	it('never reveals the full secret', () => {
		expect(maskKey('dmk_abc123_secretvalue', 'dmk_')).not.toContain('secretvalue');
	});
	it('degrades gracefully on a malformed key', () => {
		expect(maskKey('garbage', 'dmk_')).toBe('dmk_…');
	});
});
