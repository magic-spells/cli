// The shell's top-level commands against a fake Pyramid API: login --product-key,
// logout, whoami and doctor (FEATURE-WHOAMI-DOCTOR). Never production.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { KEY, SECRET, startFakeApi, type FakeApi } from './fake-api.js';
import { magic, memoryStore } from './helpers.js';

let api: FakeApi;
beforeAll(async () => {
	api = await startFakeApi();
});
afterAll(() => api.close());

const secret = (value: string) => async () => value;

describe('magic login --product-key', () => {
	it('stores a piped key under <product>:manual, detected by prefix, masked in output', async () => {
		const store = memoryStore();
		const r = await magic(['login', '--product-key'], { store, readSecret: secret(KEY) });
		expect(r.code).toBe(0);
		expect(JSON.parse(store.items['pyramid:manual']!)).toMatchObject({
			product: 'pyramid',
			key: KEY,
		});
		expect(JSON.parse(r.stdout)).toEqual({
			product: 'pyramid',
			key: 'pyk_ab23cd45_…cdef',
			stored_in: 'keychain',
		});
		expect(r.stdout + r.stderr).not.toContain(SECRET);
	});

	it('a named product checks the prefix: auth_invalid, exit 3, nothing stored', async () => {
		const store = memoryStore();
		const r = await magic(['login', '--product-key', 'pyramid'], {
			store,
			readSecret: secret('abc_123'),
		});
		expect(r.code).toBe(3);
		expect(JSON.parse(r.stderr).error).toMatchObject({ code: 'auth_invalid', product: 'pyramid' });
		expect(store.items).toEqual({});
	});

	it('refuses a key given as any argument, without echoing it', async () => {
		for (const argv of [
			['login', '--product-key', KEY],
			['login', '--product-key', 'pyramid', KEY],
			['login', '--product-key', `--key=${KEY}`],
		]) {
			const r = await magic(argv, { readSecret: secret('unused') });
			expect(r.code).toBe(2);
			expect(r.stderr).not.toContain(SECRET);
			expect(JSON.parse(r.stderr).error.message).toBe('Keys are never read from arguments.');
		}
	});

	it('leftover arguments are a usage error that does not quote them', async () => {
		const r = await magic(['login', '--product-key', 'pyramid', 'extra'], {
			readSecret: secret(KEY),
		});
		expect(r.code).toBe(2);
		expect(r.stderr).not.toContain('extra');
	});

	it('usage errors: no --product-key, empty key, unknown prefix, unknown product', async () => {
		expect((await magic(['login'])).code).toBe(2);
		expect((await magic(['login', '--product-key'], { readSecret: secret('') })).code).toBe(2);
		const unknown = await magic(['login', '--product-key'], { readSecret: secret('zzz_1_2') });
		expect(unknown.code).toBe(2);
		expect(JSON.parse(unknown.stderr).error.hint).toContain('pyk_ (pyramid)');
		expect(
			(await magic(['login', '--product-key', 'nope'], { readSecret: secret(KEY) })).code
		).toBe(2);
	});

	it('notes when MAGIC_<PRODUCT>_KEY shadows the stored key', async () => {
		const r = await magic(['login', '--product-key'], {
			readSecret: secret(KEY),
			env: { MAGIC_PYRAMID_KEY: KEY },
		});
		expect(r.stderr).toContain('MAGIC_PYRAMID_KEY is set and takes precedence');
	});

	it('--workspace is a usage error on top-level commands', async () => {
		const r = await magic(['login', '--product-key', '--workspace', 'acme'], {
			readSecret: secret(KEY),
		});
		expect(r.code).toBe(2);
	});
});

describe('magic logout', () => {
	it('forgets every product key, or one with --product', async () => {
		const store = memoryStore({ 'pyramid:manual': JSON.stringify({ key: KEY }) });
		const one = await magic(['logout', '--product', 'pyramid'], { store });
		expect(one.code).toBe(0);
		expect(JSON.parse(one.stdout)).toEqual({ removed: ['pyramid'] });
		expect(store.items).toEqual({});
		const again = await magic(['logout'], { store });
		expect(JSON.parse(again.stdout)).toEqual({ removed: [] });
		expect((await magic(['logout', '--product', 'nope'], { store })).code).toBe(2);
	});
});

describe('magic whoami', () => {
	it('with only MAGIC_PYRAMID_KEY: source env, masked key, Pyramid identity', async () => {
		const r = await magic(['whoami', '--json'], {
			env: { MAGIC_PYRAMID_KEY: KEY, MAGIC_PYRAMID_URL: api.url },
		});
		expect(r.code).toBe(0);
		const out = JSON.parse(r.stdout);
		expect(out.account).toBeNull();
		expect(out.products.pyramid).toMatchObject({
			source: 'env',
			key: 'pyk_ab23cd45_…cdef',
			identity: {
				user: { display_name: 'Ann Smith', email: 'ann@example.com' },
				workspace: { handle: 'acme', name: 'Acme' },
			},
		});
		expect(r.stdout).not.toContain(SECRET);
	});

	it('a stored key reports where it lives; a TTY gets key/value lines', async () => {
		const store = memoryStore({ 'pyramid:manual': JSON.stringify({ key: KEY }) });
		const r = await magic(['whoami'], { store, env: { MAGIC_PYRAMID_URL: api.url }, tty: true });
		expect(r.code).toBe(0);
		expect(r.stdout).toMatch(/^pyramid\n {2}source +keychain\n {2}key +pyk_ab23cd45_…cdef\n/);
		expect(r.stdout).toMatch(/workspace +Acme/);
	});

	it('no keys anywhere: every product none, exit 3', async () => {
		const r = await magic(['whoami'], {});
		expect(r.code).toBe(3);
		expect(JSON.parse(r.stdout).products.pyramid).toEqual({
			source: 'none',
			key: null,
			identity: null,
		});
	});

	it('a rejected key carries the error envelope and its exit class', async () => {
		const r = await magic(['whoami'], {
			env: { MAGIC_PYRAMID_KEY: 'pyk_ab23cd45_wrong', MAGIC_PYRAMID_URL: api.url },
		});
		expect(r.code).toBe(3);
		expect(JSON.parse(r.stdout).products.pyramid.error).toMatchObject({
			code: 'auth_invalid',
			product: 'pyramid',
		});
	});
});

describe('magic doctor', () => {
	it('all checks pass against the fake API, product checks carry product: pyramid', async () => {
		const r = await magic(['doctor', '--json'], {
			env: { MAGIC_PYRAMID_KEY: KEY, MAGIC_PYRAMID_URL: api.url },
		});
		expect(r.code).toBe(0);
		const out = JSON.parse(r.stdout);
		expect(out.ok).toBe(true);
		expect(out.checks.map((c: { name: string }) => c.name)).toEqual([
			'cli',
			'node',
			'credential store',
			'pyramid api',
			'pyramid key',
			'pyramid auth',
			'pyramid workflow',
		]);
		for (const c of out.checks.slice(3)) expect(c.product).toBe('pyramid');
	});

	it('the file store is a warning, not a failure', async () => {
		const store = { ...memoryStore(), backend: 'file' as const };
		const r = await magic(['doctor'], {
			store,
			env: { MAGIC_PYRAMID_KEY: KEY, MAGIC_PYRAMID_URL: api.url },
			tty: true,
		});
		expect(r.code).toBe(0);
		expect(r.stdout).toMatch(/^warn {2}credential store/m);
	});

	it('no key: the key check fails with not_logged_in, exit 3, product checks skipped', async () => {
		const r = await magic(['doctor'], { env: { MAGIC_PYRAMID_URL: api.url } });
		expect(r.code).toBe(3);
		const checks = JSON.parse(r.stdout).checks as { name: string; ok: boolean; code?: string }[];
		expect(checks.find((c) => c.name === 'pyramid key')).toMatchObject({
			ok: false,
			code: 'not_logged_in',
		});
		expect(checks.some((c) => c.name === 'pyramid auth')).toBe(false);
	});

	it('an unreachable API is network, exit 10', async () => {
		const closed = await startFakeApi();
		await closed.close();
		const r = await magic(['doctor'], {
			env: { MAGIC_PYRAMID_KEY: KEY, MAGIC_PYRAMID_URL: closed.url },
		});
		expect(r.code).toBe(10);
		const api = JSON.parse(r.stdout).checks.find((c: { name: string }) => c.name === 'pyramid api');
		expect(api.detail).toContain('Check MAGIC_PYRAMID_URL');
	});
});
