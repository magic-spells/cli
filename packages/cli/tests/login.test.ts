// `magic login | whoami | logout | doctor` through Account (FEATURE-DEVICE-LOGIN), end
// to end in-process against a fake Account and fake Pyramid, Sites and Marketing
// servers. Never production.

import { hostname } from 'node:os';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
	fakeBrowser,
	startFakeAccount,
	startFakeProduct,
	type FakeAccount,
	type FakeProduct,
	type FakeWorkspace,
} from '../../kit/tests/fakes.js';
import { buildMcp } from '../src/commands/mcp.js';
import { PRODUCTS } from '../src/products.js';
import { run, type ShellDeps } from '../src/main.js';
import { magic, memoryStore } from './helpers.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const ACME: FakeWorkspace = { id: 'w1', handle: 'acme', name: 'Acme', role: 'owner' };
const BETA: FakeWorkspace = { id: 'w2', handle: 'beta', name: 'Beta', role: 'member' };
const SHOP: FakeWorkspace = { id: 's1', handle: 'shop', name: 'Shop', role: 'admin' };

let account: FakeAccount;
let pyramid: FakeProduct;
let sites: FakeProduct;
let marketing: FakeProduct;

beforeAll(async () => {
	account = await startFakeAccount();
	const me = { id: 'u-ann', display_name: 'Ann Smith', email: 'ann@example.com' };
	pyramid = await startFakeProduct({
		id: 'pyramid',
		prefix: 'pyk_',
		path: '/v1/cli/sessions',
		account,
		workspaces: [ACME, BETA],
		routes: {
			'GET /v1/me': me,
			'GET /v1/workspaces': (handle: string) => ({
				data: [{ id: 'w', handle, name: handle, role: 'owner' }],
			}),
			'GET /v1/projects': { data: [] },
		},
	});
	sites = await startFakeProduct({
		id: 'sites',
		prefix: 'sites_',
		path: '/v1/cli/sessions',
		account,
		workspaces: [SHOP],
	});
	marketing = await startFakeProduct({
		id: 'marketing',
		prefix: 'marketing_live_',
		path: '/api/v1/cli/sessions',
		account,
		workspaces: [],
	});
});
afterAll(async () => {
	for (const s of [pyramid, sites, marketing, account]) await s.close();
});
beforeEach(() => {
	account.authorize = 'approve';
	account.deviceSteps = ['approve'];
	account.revokeSupported = true;
	pyramid.workspaces = [ACME, BETA];
	sites.workspaces = [SHOP];
	marketing.workspaces = [];
	sites.down = false;
	for (const s of [account, pyramid, sites, marketing]) s.requests.length = 0;
});

function env(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
	return {
		MAGIC_ACCOUNT_URL: account.url,
		MAGIC_ACCOUNT_CLIENT_ID: account.clientId,
		MAGIC_PYRAMID_URL: pyramid.url,
		MAGIC_SITES_URL: sites.url,
		MAGIC_MARKETING_URL: marketing.url,
		...extra,
	};
}

/** A clock whose sleep moves time on at once, for the device poll. */
function fastClock(onSleep?: () => void) {
	let t = 0;
	return {
		now: () => t,
		sleep: async (ms: number) => {
			t += ms;
			onSleep?.();
		},
	};
}

/** A desktop with a browser that approves at once. */
function desktop(deps: ShellDeps = {}): ShellDeps {
	return {
		env: env(),
		platform: 'darwin',
		openBrowser: fakeBrowser(),
		login: fastClock(),
		...deps,
	};
}

/** The error envelope: the last stderr line (notes may come first). */
function errorOf(stderr: string) {
	return JSON.parse(stderr.slice(stderr.lastIndexOf('\n{') + 1)).error;
}

async function loggedIn(store = memoryStore()) {
	const r = await magic(['login'], desktop({ store }));
	expect(r.code).toBe(0);
	return store;
}

const secretsIn = (store: ReturnType<typeof memoryStore>): string[] =>
	Object.values(store.items).flatMap((v) => {
		const j = JSON.parse(v) as { key?: string; access_token?: string };
		return [j.key, j.access_token].filter((s): s is string => typeof s === 'string');
	});

describe('magic login (loopback)', () => {
	it('signs in through the browser, mints every product in parallel, reports per product', async () => {
		const store = memoryStore();
		const opened: string[] = [];
		const r = await magic(['login'], desktop({ store, openBrowser: fakeBrowser(opened) }));
		expect(r.code).toBe(0);

		// The browser went to /auth/authorize with PKCE; the exchange carried the verifier.
		const authorize = new URL(opened[0]!);
		expect(authorize.pathname).toBe('/auth/authorize');
		expect(authorize.searchParams.get('redirect_uri')).toMatch(
			/^http:\/\/127\.0\.0\.1:\d+\/callback$/
		);
		const token = account.requests.find((q) => q.path === '/auth/token')!;
		expect(token.body).toMatchObject({
			grant_type: 'authorization_code',
			client_id: account.clientId,
		});

		// Every product got the grant as Bearer and the hostname label.
		const grant = JSON.parse(store.items['account:grant']!);
		for (const p of [pyramid, sites, marketing]) {
			const mint = p.requests.find((q) => q.method === 'POST')!;
			expect(mint.authorization).toBe(`Bearer ${grant.access_token}`);
			expect(mint.body).toEqual({ label: `magic on ${hostname()}` });
		}

		expect(Object.keys(store.items).sort()).toEqual([
			'account:grant',
			'account:sessions',
			'pyramid:acme',
			'pyramid:beta',
			'sites:shop',
		]);
		expect(grant).toMatchObject({
			token_type: 'Bearer',
			user: { id: 'u-ann', display_name: 'Ann Smith', email: 'ann@example.com' },
			account_url: account.url,
		});
		expect(grant.access_token).toMatch(/^magic_/);
		expect(JSON.parse(store.items['sites:shop']!)).toMatchObject({
			product: 'sites',
			workspace: { handle: 'shop' },
			role: 'admin',
			source: 'account',
		});

		expect(JSON.parse(r.stdout)).toEqual({
			account: {
				user: { id: 'u-ann', display_name: 'Ann Smith', email: 'ann@example.com' },
				expires_at: grant.expires_at,
				account_url: account.url,
			},
			products: {
				pyramid: { workspaces: ['acme', 'beta'], default: null },
				sites: { workspaces: ['shop'], default: 'shop' },
				marketing: {
					error: expect.objectContaining({ code: 'permission_denied', product: 'marketing' }),
				},
			},
		});
		expect(r.stderr).toContain('Logged in as Ann Smith (ann@example.com).');
		expect(r.stderr).toMatch(/pyramid +2 workspaces: acme, beta \(use --workspace/);
		expect(r.stderr).toMatch(/sites +1 workspace: shop \(default\)/);
		expect(r.stderr).toMatch(/marketing +skipped: You have no Marketing workspaces\./);
		for (const secret of secretsIn(store)) expect(r.stdout + r.stderr).not.toContain(secret);
	});

	it('a product that is down is skipped; login still succeeds', async () => {
		sites.down = true;
		const store = memoryStore();
		const r = await magic(['login'], desktop({ store }));
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout).products.sites.error.code).toBe('unknown');
		expect(store.items['sites:shop']).toBeUndefined();
		expect(store.items['pyramid:acme']).toBeDefined();
	});

	it('the browser denying is auth_cancelled, exit 3, nothing stored', async () => {
		account.authorize = 'deny';
		const store = memoryStore();
		const r = await magic(['login'], desktop({ store }));
		expect(r.code).toBe(3);
		expect(errorOf(r.stderr)).toMatchObject({
			code: 'auth_cancelled',
			product: 'account',
		});
		expect(store.items).toEqual({});
	});

	it('no callback within the timeout: exit 3 with the --device hint, nothing stored', async () => {
		account.authorize = 'ignore';
		const store = memoryStore();
		const r = await magic(['login'], desktop({ store, login: { loopbackTimeoutMs: 50 } }));
		expect(r.code).toBe(3);
		expect(errorOf(r.stderr).hint).toContain('magic login --device');
		expect(store.items).toEqual({});
	});

	it('when the browser cannot open, the URL is printed and login keeps listening', async () => {
		const store = memoryStore();
		let printed = '';
		// Approve "by hand": follow the printed URL like a person would.
		const io = {
			out: () => {},
			err: (t: string) => {
				printed += t;
				const url = /\n {2}(http\S+auth\/authorize\S+)\n/.exec(printed)?.[1];
				if (url) void fetch(url).catch(() => {});
			},
			isTTY: () => false,
		};
		const code = await run(['login'], {
			...desktop({ store, openBrowser: async () => false }),
			env: { XDG_CONFIG_HOME: '/nonexistent', ...env() },
			io,
		});
		expect(code).toBe(0);
		expect(printed).toContain('Open this page to sign in to Magic Spells:');
		expect(store.items['account:grant']).toBeDefined();
	});

	it('refuses the placeholder client id before opening a browser', async () => {
		const opened: string[] = [];
		const r = await magic(
			['login'],
			desktop({ env: env({ MAGIC_ACCOUNT_CLIENT_ID: '' }), openBrowser: fakeBrowser(opened) })
		);
		expect(r.code).toBe(2);
		expect(errorOf(r.stderr).hint).toContain('MAGIC_ACCOUNT_CLIENT_ID');
		expect(opened).toEqual([]);
	});
});

describe('magic login (device)', () => {
	it('--device prints the code large and the URL, polls, and stores the grant', async () => {
		account.deviceSteps = ['authorization_pending', 'slow_down', 'approve'];
		const store = memoryStore();
		const opened: string[] = [];
		const r = await magic(
			['login', '--device'],
			desktop({ store, openBrowser: fakeBrowser(opened) })
		);
		expect(r.code).toBe(0);
		expect(r.stderr).toContain(`${account.url}/device`);
		expect(r.stderr).toContain('W D J B - M J H T');
		// A local browser opens the complete URL.
		expect(opened).toEqual([`${account.url}/device?code=WDJB-MJHT`]);
		expect(account.requests.find((q) => q.path === '/auth/device')!.body).toEqual({
			client_id: account.clientId,
			scope: 'basic',
		});
		expect(store.items['account:grant']).toBeDefined();
	});

	it('over SSH the device flow is chosen and no browser opens', async () => {
		const opened: string[] = [];
		const r = await magic(
			['login'],
			desktop({ env: env({ SSH_CONNECTION: '1 2 3 4' }), openBrowser: fakeBrowser(opened) })
		);
		expect(r.code).toBe(0);
		expect(r.stderr).toContain('W D J B - M J H T');
		expect(opened).toEqual([]);
	});

	it('Linux without a display uses the device flow too', async () => {
		const r = await magic(['login'], desktop({ platform: 'linux' }));
		expect(r.code).toBe(0);
		expect(r.stderr).toContain('enter the code');
	});

	it('Ctrl-C while waiting stores nothing and exits 3', async () => {
		account.deviceSteps = ['authorization_pending'];
		const ctl = new AbortController();
		let slept = 0;
		const store = memoryStore();
		const r = await magic(
			['login', '--device'],
			desktop({
				store,
				login: {
					interrupt: ctl.signal,
					...fastClock(() => {
						if (++slept === 7) ctl.abort();
					}),
				},
			})
		);
		expect(r.code).toBe(3);
		expect(errorOf(r.stderr).code).toBe('auth_cancelled');
		expect(store.items).toEqual({});
	});

	it('an expired code exits 3 with "run magic login again"', async () => {
		account.deviceSteps = ['expired_token'];
		const r = await magic(['login', '--device'], desktop());
		expect(r.code).toBe(3);
		expect(errorOf(r.stderr)).toMatchObject({
			code: 'auth_expired',
			hint: 'Run `magic login` again.',
		});
	});
});

describe('a second login and --product', () => {
	it('asks before replacing; without a terminal it needs --yes', async () => {
		const store = await loggedIn();
		const before = store.items['account:grant'];
		const r = await magic(['login'], desktop({ store }));
		expect(r.code).toBe(2);
		expect(errorOf(r.stderr).message).toBe('Already logged in as Ann Smith (ann@example.com).');
		const no = await magic(['login'], desktop({ store, confirm: async () => false }));
		expect(no.code).toBe(2);
		expect(store.items['account:grant']).toBe(before);
	});

	it('--yes replaces, then revokes the old grant and its product keys', async () => {
		const store = await loggedIn();
		const old = JSON.parse(store.items['account:grant']!);
		const oldKeys = secretsIn(store).filter((k) => !k.startsWith('magic_'));
		const r = await magic(['login', '--yes'], desktop({ store }));
		expect(r.code).toBe(0);
		const now = JSON.parse(store.items['account:grant']!);
		expect(now.access_token).not.toBe(old.access_token);
		expect(account.isActive(old.access_token)).toBe(false);
		expect(account.isActive(now.access_token)).toBe(true);
		const live = [...pyramid.liveKeys(), ...sites.liveKeys()];
		for (const k of oldKeys) expect(live).not.toContain(k);
		for (const k of secretsIn(store).filter((k) => !k.startsWith('magic_')))
			expect(live).toContain(k);
	});

	it('--product sites re-mints one product from the stored grant, no Account call', async () => {
		const store = await loggedIn();
		const oldKey = JSON.parse(store.items['sites:shop']!).key;
		for (const s of [account, pyramid, sites]) s.requests.length = 0;
		const r = await magic(['login', '--product', 'sites'], desktop({ store }));
		expect(r.code).toBe(0);
		expect(account.requests).toEqual([]);
		expect(pyramid.requests).toEqual([]);
		expect(JSON.parse(store.items['sites:shop']!).key).not.toBe(oldKey);
		expect(Object.keys(JSON.parse(r.stdout).products)).toEqual(['sites']);
	});

	it('--product with an unknown product is a usage error', async () => {
		expect((await magic(['login', '--product', 'nope'], desktop())).code).toBe(2);
	});
});

describe('whoami, silent re-mint, logout, doctor after login', () => {
	it('whoami shows the person, the grant expiry and each product, masked', async () => {
		const store = await loggedIn();
		const r = await magic(['whoami', '--json'], desktop({ store }));
		expect(r.code).toBe(0);
		const out = JSON.parse(r.stdout);
		const grant = JSON.parse(store.items['account:grant']!);
		expect(out.account).toEqual({
			user: { id: 'u-ann', display_name: 'Ann Smith', email: 'ann@example.com' },
			grant_id: grant.grant_id,
			expires_at: grant.expires_at,
			idle_expires_at: new Date(Date.parse(grant.last_used_at) + 14 * 86_400_000).toISOString(),
			account_url: account.url,
		});
		expect(out.products.pyramid).toMatchObject({
			source: 'account',
			stored_in: 'keychain',
			key: null,
			default: null,
			workspaces: [
				{
					handle: 'acme',
					name: 'Acme',
					role: 'owner',
					key: expect.stringMatching(/^pyk_[0-9a-f]{8}_…/),
				},
				{ handle: 'beta', name: 'Beta', role: 'member' },
			],
		});
		expect(out.products.sites).toMatchObject({
			source: 'account',
			default: 'shop',
			key: expect.stringMatching(/^sites_/),
		});
		expect(out.products.marketing).toMatchObject({ source: 'none' });
		for (const secret of secretsIn(store)) expect(r.stdout).not.toContain(secret);
	});

	it('an expired product key is re-minted once and the command succeeds', async () => {
		const store = await loggedIn();
		const oldKey = JSON.parse(store.items['pyramid:acme']!).key;
		pyramid.expireNext = true;
		const r = await magic(['pyramid', 'whoami', '--workspace', 'acme'], desktop({ store }));
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout).user.email).toBe('ann@example.com');
		expect(JSON.parse(store.items['pyramid:acme']!).key).not.toBe(oldKey);
		expect(pyramid.requests.filter((q) => q.method === 'POST').at(-1)!.body).toMatchObject({
			workspace: 'acme',
		});
	});

	it('a dead grant turns the expired key into not_logged_in "run magic login"', async () => {
		const store = await loggedIn();
		account.expireAll();
		pyramid.expireNext = true;
		const r = await magic(['pyramid', 'whoami', '--workspace', 'acme'], desktop({ store }));
		expect(r.code).toBe(3);
		expect(errorOf(r.stderr)).toMatchObject({
			code: 'not_logged_in',
			hint: 'Run `magic login`.',
		});
	});

	it('several workspaces and no --workspace is a usage error listing them', async () => {
		const store = await loggedIn();
		const r = await magic(['pyramid', 'whoami'], desktop({ store }));
		expect(r.code).toBe(2);
		expect(errorOf(r.stderr).candidates).toEqual(['acme', 'beta']);
	});

	it('MCP tools use the same store, including the account session', async () => {
		pyramid.workspaces = [ACME];
		const store = await loggedIn();
		const built = await buildMcp(
			{
				io: { out: () => {}, err: () => {}, isTTY: () => false },
				env: env(),
				store,
				entries: PRODUCTS,
				opts: { json: false, yes: false, quiet: false },
				readConfig: () => null,
				readSecret: async () => '',
				openBrowser: async () => false,
				confirm: null,
				platform: 'darwin',
				login: {},
			},
			[],
			new AbortController().signal
		);
		// Sign-in-only products have no tools and are left out.
		expect(built.products.map((p) => p.module.id)).toEqual(['pyramid']);
		const [a, b] = InMemoryTransport.createLinkedPair();
		const client = new Client({ name: 'harness', version: '0.0.0' });
		await Promise.all([built.server.connect(a), client.connect(b)]);
		pyramid.expireNext = true;
		const res = await client.callTool({ name: 'pyramid_whoami', arguments: {} });
		expect(res.isError).toBeFalsy();
		await client.close();
	});

	it('logout revokes each product server-side, revokes the grant, empties the store', async () => {
		const store = await loggedIn();
		const grant = JSON.parse(store.items['account:grant']!);
		const keys = secretsIn(store).filter((k) => !k.startsWith('magic_'));
		const r = await magic(['logout'], desktop({ store }));
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout)).toEqual({
			removed: ['pyramid', 'sites'],
			revoked: ['pyramid', 'sites'],
			account: 'revoked',
		});
		expect(store.items).toEqual({});
		const live = [...pyramid.liveKeys(), ...sites.liveKeys()];
		for (const k of keys) expect(live).not.toContain(k);
		expect(account.isActive(grant.access_token)).toBe(false);
		const del = pyramid.requests.find((q) => q.method === 'DELETE')!;
		expect(del.authorization).toMatch(/^Bearer pyk_/);
		expect(account.requests.at(-1)).toMatchObject({
			path: '/auth/revoke',
			body: { token: grant.access_token },
		});

		const who = await magic(['whoami', '--json'], desktop({ store }));
		expect(who.code).toBe(3);
		expect(JSON.parse(who.stdout).account).toBeNull();
	});

	it('logout when Account has no revoke endpoint still forgets everything, and says so', async () => {
		account.revokeSupported = false;
		const store = await loggedIn();
		const r = await magic(['logout'], desktop({ store }));
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout).account).toBe('unsupported');
		expect(r.stderr).toContain('does not offer grant revocation');
		expect(store.items).toEqual({});
	});

	it('logout --product keeps the sign-in and the other products', async () => {
		const store = await loggedIn();
		const r = await magic(['logout', '--product', 'pyramid'], desktop({ store }));
		expect(JSON.parse(r.stdout)).toEqual({
			removed: ['pyramid'],
			revoked: ['pyramid'],
			account: 'kept',
		});
		expect(Object.keys(store.items).sort()).toEqual([
			'account:grant',
			'account:sessions',
			'sites:shop',
		]);
	});

	it('doctor reports Account reachable and the grant', async () => {
		const store = await loggedIn();
		const r = await magic(['doctor', '--json'], desktop({ store }));
		const checks = JSON.parse(r.stdout).checks as {
			name: string;
			ok: boolean;
			warn?: boolean;
			detail: string;
		}[];
		expect(checks.find((c) => c.name === 'account')).toMatchObject({ ok: true });
		expect(checks.find((c) => c.name === 'account grant')!.detail).toContain('Ann Smith');
		// Marketing minted nothing: a warning while signed in, not a failure.
		expect(checks.find((c) => c.name === 'marketing key')).toMatchObject({ ok: true, warn: true });
		// Pyramid has two workspaces and no default: a warning too.
		expect(checks.find((c) => c.name === 'pyramid key')).toMatchObject({ ok: true, warn: true });
		expect(r.code).toBe(0);
	});
});

describe('pasted keys for the sign-in-only products', () => {
	it('marketing_test_ and marketing_live_ keys are both Marketing keys', async () => {
		for (const key of ['marketing_test_ab12_0123456789', 'marketing_live_ab12_0123456789']) {
			const store = memoryStore();
			const r = await magic(['login', '--product-key'], { store, readSecret: async () => key });
			expect(r.code).toBe(0);
			expect(JSON.parse(r.stdout).product).toBe('marketing');
			expect(JSON.parse(store.items['marketing:manual']!).key).toBe(key);
		}
	});
});
