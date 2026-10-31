// Product sessions from the Account grant: mint, store, resolve by workspace, and the
// silent re-mint on auth_expired (FLOW-PRODUCT-SESSION-MINT), against the fakes.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { runProductCli } from '../src/cli.js';
import { manualItem, resolveCredential } from '../src/credentials.js';
import { mapHttpError } from '../src/errors.js';
import { callTool } from '../src/mcp.js';
import { buildContext, productConfig, remintFor } from '../src/context.js';
import type { Operation, ProductModule } from '../src/operation.js';
import {
	GRANT_ITEM,
	SESSIONS_ITEM,
	forgetSessions,
	grantFromToken,
	grantIdleExpiry,
	mintSessions,
	productSessions,
	readGrant,
	readIndex,
	revokeSessions,
	saveGrant,
	storeSessions,
} from '../src/sessions.js';
import { startFakeAccount, startFakeProduct, type FakeAccount, type FakeProduct } from './fakes.js';
import { captureIO, memoryStore } from './helpers.js';

const WS = [
	{ id: 'w1', handle: 'acme', name: 'Acme', role: 'owner' },
	{ id: 'w2', handle: 'beta', name: 'Beta', role: 'member' },
];

let account: FakeAccount;
let api: FakeProduct;
beforeAll(async () => {
	account = await startFakeAccount();
	api = await startFakeProduct({
		id: 'demo',
		prefix: 'dmk_',
		path: '/v1/cli/sessions',
		account,
		workspaces: WS,
		routes: { 'GET /v1/ping': (handle: string) => ({ pong: handle }) },
	});
});
afterAll(async () => {
	await api.close();
	await account.close();
});
beforeEach(() => {
	api.workspaces = WS;
	api.expireNext = false;
	api.requests.length = 0;
});

const ping: Operation<Record<string, never>, unknown, { key: string; url: string }> = {
	name: 'demo.ping',
	summary: 'Ping',
	input: z.object({}),
	async run(_i, ctx) {
		const res = await fetch(`${ctx.client.url}/v1/ping`, {
			headers: { authorization: `Bearer ${ctx.client.key}` },
		});
		const body = (await res.json()) as unknown;
		if (!res.ok) throw mapHttpError(res.status, body, { product: 'demo' });
		return body;
	},
};

const demo = (): ProductModule<{ key: string; url: string }> => ({
	id: 'demo',
	title: 'Demo',
	credential: 'dmk_',
	apiUrl: api.url,
	sessions: { path: '/v1/cli/sessions' },
	load: async () => [ping],
	client: (session, config) => ({ key: session.key, url: config.products.demo!.apiUrl }),
});

/** A live grant from the fake Account, stored. */
async function loggedIn(store = memoryStore()) {
	const res = await fetch(`${account.url}/auth/device`, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: `client_id=${account.clientId}&scope=basic`,
	});
	const { device_code } = (await res.json()) as { device_code: string };
	account.deviceSteps = ['approve'];
	const tok = await fetch(`${account.url}/auth/token`, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
			device_code,
			client_id: account.clientId,
		}).toString(),
	});
	const grant = grantFromToken((await tok.json()) as never, account.url);
	await saveGrant(store, grant);
	return { store, grant };
}

describe('mint and store', () => {
	it('POSTs the grant as Bearer with { label }, stores one item per workspace', async () => {
		const { store, grant } = await loggedIn();
		const res = await mintSessions(demo(), {
			apiUrl: api.url,
			grant: grant.access_token,
			label: 'magic on box',
		});
		const req = api.requests.at(-1)!;
		expect(req.authorization).toBe(`Bearer ${grant.access_token}`);
		expect(req.contentType).toBe('application/json');
		expect(req.body).toEqual({ label: 'magic on box' });
		expect(res.sessions.map((s) => s.workspace?.handle)).toEqual(['acme', 'beta']);

		const entry = await storeSessions(store, 'demo', res);
		expect(entry.default).toBeUndefined();
		expect(entry.workspaces.map((w) => [w.handle, w.role])).toEqual([
			['acme', 'owner'],
			['beta', 'member'],
		]);
		expect(JSON.parse(store.items['demo:acme']!)).toMatchObject({
			source: 'account',
			product: 'demo',
		});
		expect(Object.keys(store.items).sort()).toEqual([
			GRANT_ITEM,
			SESSIONS_ITEM,
			'demo:acme',
			'demo:beta',
		]);
	});

	it('one workspace becomes the default; workspaces dropped since are deleted', async () => {
		const { store, grant } = await loggedIn();
		await storeSessions(
			store,
			'demo',
			await mintSessions(demo(), { apiUrl: api.url, grant: grant.access_token })
		);
		api.workspaces = [WS[1]!];
		const entry = await storeSessions(
			store,
			'demo',
			await mintSessions(demo(), { apiUrl: api.url, grant: grant.access_token })
		);
		expect(entry.default).toBe('beta');
		expect(store.items['demo:acme']).toBeUndefined();
		expect((await resolveCredential(demo(), { env: {}, store })).workspace?.handle).toBe('beta');
	});

	it('maps 401 to not_logged_in, 403 to no_workspaces, 404 to a workspace not_found', async () => {
		const { grant } = await loggedIn();
		const spec = demo();
		await expect(
			mintSessions(spec, { apiUrl: api.url, grant: 'magic_dead' })
		).rejects.toMatchObject({
			code: 'not_logged_in',
			hint: 'Run `magic login`.',
		});
		await expect(
			mintSessions(spec, { apiUrl: api.url, grant: grant.access_token, workspace: 'nope' })
		).rejects.toMatchObject({ code: 'not_found', details: { kind: 'workspace' } });
		api.workspaces = [];
		await expect(
			mintSessions(spec, { apiUrl: api.url, grant: grant.access_token })
		).rejects.toMatchObject({
			code: 'permission_denied',
			details: { reason: 'no_workspaces' },
		});
	});

	it('DELETE with the product key revokes every key from that grant', async () => {
		const { store, grant } = await loggedIn();
		await storeSessions(
			store,
			'demo',
			await mintSessions(demo(), { apiUrl: api.url, grant: grant.access_token })
		);
		const [first] = await productSessions(store, 'demo');
		await revokeSessions(demo(), { apiUrl: api.url, key: first!.key });
		const del = api.requests.at(-1)!;
		expect([del.method, del.authorization]).toEqual(['DELETE', `Bearer ${first!.key}`]);
		for (const s of await productSessions(store, 'demo'))
			expect(api.liveKeys()).not.toContain(s.key);
		expect(await forgetSessions(store, 'demo')).toEqual(['demo:acme', 'demo:beta']);
		expect(await readIndex(store)).toEqual({});
		expect(store.items[SESSIONS_ITEM]).toBeUndefined();
	});

	it('the idle expiry is last use + 14 days, capped at the absolute expiry', async () => {
		const { store } = await loggedIn();
		const g = (await readGrant(store))!;
		expect(Date.parse(grantIdleExpiry(g)) - Date.parse(g.last_used_at)).toBe(14 * 86_400_000);
		expect(
			await readGrant(memoryStore({ [GRANT_ITEM]: JSON.stringify({ access_token: 'x_1' }) }))
		).toBeNull();
	});
});

describe('resolveCredential with account sessions', () => {
	it('env wins; --workspace picks; several without a default is a usage error', async () => {
		const { store, grant } = await loggedIn();
		await storeSessions(
			store,
			'demo',
			await mintSessions(demo(), { apiUrl: api.url, grant: grant.access_token })
		);
		expect(
			(await resolveCredential(demo(), { env: { MAGIC_DEMO_KEY: 'dmk_e_1' }, store })).source
		).toBe('env');
		const beta = await resolveCredential(demo(), { env: {}, store, workspace: 'beta' });
		expect(beta).toMatchObject({
			source: 'account',
			workspace: { handle: 'beta' },
			role: 'member',
		});
		const many = await resolveCredential(demo(), { env: {}, store }).catch((e) => e);
		expect(many).toMatchObject({ code: 'usage', candidates: ['acme', 'beta'] });
		const missing = await resolveCredential(demo(), { env: {}, store, workspace: 'zeta' }).catch(
			(e) => e
		);
		expect(missing).toMatchObject({ code: 'not_found', candidates: ['acme', 'beta'] });
	});

	it('a manual key still answers when no account workspace is chosen', async () => {
		const { store, grant } = await loggedIn();
		await storeSessions(
			store,
			'demo',
			await mintSessions(demo(), { apiUrl: api.url, grant: grant.access_token })
		);
		store.items[manualItem('demo')] = JSON.stringify({ key: 'dmk_m_1', source: 'manual' });
		expect((await resolveCredential(demo(), { env: {}, store })).source).toBe('manual');
	});

	it('not_logged_in hints magic login for a product with sessions', async () => {
		const err = await resolveCredential(demo(), { env: {}, store: memoryStore() }).catch((e) => e);
		expect(err.code).toBe('not_logged_in');
		expect(err.hint).toMatch(/^Run `magic login`, or set MAGIC_DEMO_KEY/);
	});
});

describe('silent re-mint', () => {
	async function oneWorkspace() {
		api.workspaces = [WS[0]!];
		const { store, grant } = await loggedIn();
		await storeSessions(
			store,
			'demo',
			await mintSessions(demo(), { apiUrl: api.url, grant: grant.access_token })
		);
		return { store, grant, oldKey: JSON.parse(store.items['demo:acme']!).key as string };
	}

	it('CLI: auth_expired on an account session re-mints once, retries once, stores the new key', async () => {
		const { store, oldKey } = await oneWorkspace();
		api.expireNext = true;
		const io = captureIO();
		const code = await runProductCli(demo(), ['ping'], {
			env: {},
			store,
			io,
			readConfig: () => null,
		});
		expect(code).toBe(0);
		expect(JSON.parse(io.stdout)).toEqual({ pong: 'acme' });
		const newKey = JSON.parse(store.items['demo:acme']!).key as string;
		expect(newKey).not.toBe(oldKey);
		const mints = api.requests.filter((r) => r.method === 'POST');
		expect(mints.at(-1)!.body).toMatchObject({ workspace: 'acme' });
		expect(api.requests.filter((r) => r.path === '/v1/ping')).toHaveLength(2);
	});

	it('MCP: the same re-mint through callTool', async () => {
		const { store, oldKey } = await oneWorkspace();
		api.expireNext = true;
		const product = demo();
		const config = productConfig(product, { env: {}, readConfig: () => null });
		const out = await callTool(
			'demo',
			ping,
			() => buildContext(product, config, { env: {}, store }),
			{},
			remintFor(product, store)
		);
		expect(out.isError).toBeUndefined();
		expect(JSON.parse(store.items['demo:acme']!).key).not.toBe(oldKey);
	});

	it('a dead grant turns auth_expired into not_logged_in "run magic login"', async () => {
		const { store } = await oneWorkspace();
		account.expireAll();
		api.expireNext = true;
		const io = captureIO();
		const code = await runProductCli(demo(), ['ping'], {
			env: {},
			store,
			io,
			readConfig: () => null,
		});
		expect(code).toBe(3);
		expect(JSON.parse(io.stderr).error).toMatchObject({
			code: 'not_logged_in',
			hint: 'Run `magic login`.',
		});
	});

	it('manual keys are never re-minted', async () => {
		const { store } = await oneWorkspace();
		const mintsBefore = api.requests.filter((r) => r.method === 'POST').length;
		const manualKey = JSON.parse(store.items['demo:acme']!).key as string;
		const manualOnly = memoryStore({
			[manualItem('demo')]: JSON.stringify({ key: manualKey, source: 'manual' }),
		});
		api.expireNext = true;
		const io = captureIO();
		const code = await runProductCli(demo(), ['ping'], {
			env: {},
			store: manualOnly,
			io,
			readConfig: () => null,
		});
		expect(code).toBe(3);
		expect(JSON.parse(io.stderr).error.code).toBe('auth_expired');
		expect(api.requests.filter((r) => r.method === 'POST')).toHaveLength(mintsBefore);
	});
});
