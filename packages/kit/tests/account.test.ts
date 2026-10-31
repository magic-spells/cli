// The Account client against the fake Account: PKCE, the authorize URL, the code
// exchange, the device flow (pending, slow_down, denied, expired, Ctrl-C) and revoke.

import { createHash } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
	AccountClient,
	DEVICE_GRANT_TYPE,
	authorizeUrl,
	createPkce,
	randomState,
	waitForDevice,
} from '../src/account.js';
import { ACCOUNT_CLIENT_ID_PLACEHOLDER } from '../src/config.js';
import { startLoopback } from '../src/loopback.js';
import { startFakeAccount, type FakeAccount } from './fakes.js';

let account: FakeAccount;
let client: AccountClient;
beforeAll(async () => {
	account = await startFakeAccount();
	client = new AccountClient({ accountUrl: account.url, clientId: account.clientId });
});
afterAll(() => account.close());
beforeEach(() => {
	account.requests.length = 0;
	account.authorize = 'approve';
	account.deviceSteps = ['approve'];
	account.revokeSupported = true;
});

/** A fake clock whose sleep advances time instantly. */
function clock() {
	let t = 0;
	return {
		now: () => t,
		sleep: async (ms: number) => void (t += ms),
		get t() {
			return t;
		},
	};
}

describe('PKCE and the authorize URL', () => {
	it('verifier is 32 bytes base64url; challenge is its S256', () => {
		const p = createPkce();
		expect(Buffer.from(p.verifier, 'base64url')).toHaveLength(32);
		expect(p.challenge).toBe(createHash('sha256').update(p.verifier).digest('base64url'));
		expect(randomState()).toMatch(/^[\w-]{32}$/);
	});

	it('carries every parameter Account checks', () => {
		const u = new URL(
			authorizeUrl({
				accountUrl: 'https://account.example',
				clientId: 'cid',
				redirectUri: 'http://127.0.0.1:5555/callback',
				state: 'st',
				challenge: 'ch',
			})
		);
		expect(u.origin + u.pathname).toBe('https://account.example/auth/authorize');
		expect(Object.fromEntries(u.searchParams)).toEqual({
			client_id: 'cid',
			redirect_uri: 'http://127.0.0.1:5555/callback',
			state: 'st',
			code_challenge: 'ch',
			code_challenge_method: 'S256',
			scope: 'basic',
		});
	});

	it('refuses the placeholder client id with a usage error', () => {
		expect(
			() => new AccountClient({ accountUrl: account.url, clientId: ACCOUNT_CLIENT_ID_PLACEHOLDER })
		).toThrow(/no Account client id/);
	});
});

describe('loopback exchange', () => {
	it('authorize -> loopback -> token with the verifier; Account verifies PKCE', async () => {
		const pkce = createPkce();
		const state = randomState();
		const lb = await startLoopback({
			state,
			exchange: (code, redirectUri, signal) =>
				client.exchangeCode({ code, verifier: pkce.verifier, redirectUri, signal }),
		});
		const page = await fetch(
			authorizeUrl({
				accountUrl: account.url,
				clientId: account.clientId,
				redirectUri: lb.redirectUri,
				state,
				challenge: pkce.challenge,
			})
		);
		expect(await page.text()).toContain('You can close this tab');
		const token = await lb.result;
		expect(token.access_token).toMatch(/^magic_/);
		expect(token.expires_in).toBe(5184000);
		const exchange = account.requests.find((r) => r.path === '/auth/token')!;
		expect(exchange.contentType).toBe('application/x-www-form-urlencoded');
		expect(exchange.body).toEqual({
			grant_type: 'authorization_code',
			code: expect.any(String),
			code_verifier: pkce.verifier,
			client_id: account.clientId,
			redirect_uri: lb.redirectUri,
		});
	});

	it('a wrong verifier is invalid_grant -> auth_invalid', async () => {
		const lb = await startLoopback({
			state: 's',
			exchange: (code, redirectUri, signal) =>
				client.exchangeCode({ code, verifier: 'wrong', redirectUri, signal }),
		});
		await fetch(
			authorizeUrl({
				accountUrl: account.url,
				clientId: account.clientId,
				redirectUri: lb.redirectUri,
				state: 's',
				challenge: createPkce().challenge,
			})
		);
		await expect(lb.result).rejects.toMatchObject({ code: 'auth_invalid', product: 'account' });
	});
});

describe('device flow', () => {
	it('start sends client_id + scope; polls send the device grant', async () => {
		const start = await client.startDevice();
		expect(start).toMatchObject({ user_code: 'WDJB-MJHT', expires_in: 600, interval: 5 });
		const c = clock();
		const token = await waitForDevice(client, start, c);
		expect(token.access_token).toMatch(/^magic_/);
		expect(account.requests[0]!.body).toEqual({ client_id: account.clientId, scope: 'basic' });
		expect(account.requests[1]!.body).toEqual({
			grant_type: DEVICE_GRANT_TYPE,
			device_code: start.device_code,
			client_id: account.clientId,
		});
	});

	it('honours the interval and adds 5 s on slow_down', async () => {
		account.deviceSteps = [
			'authorization_pending',
			'slow_down',
			'authorization_pending',
			'approve',
		];
		const start = await client.startDevice();
		const c = clock();
		const polls: number[] = [];
		const realPoll = client.pollDevice.bind(client);
		const spy = Object.assign(Object.create(client) as AccountClient, {
			pollDevice: (code: string, signal?: AbortSignal) => {
				polls.push(c.t);
				return realPoll(code, signal);
			},
		});
		const ticks: number[] = [];
		await waitForDevice(spy, start, { ...c, onTick: (s) => ticks.push(s) });
		expect(polls).toEqual([5000, 10000, 20000, 30000]);
		expect(ticks[0]).toBe(600);
		expect(ticks.at(-1)).toBe(571);
	});

	it('access_denied is auth_cancelled; expired_token is auth_expired', async () => {
		account.deviceSteps = ['authorization_pending', 'access_denied'];
		await expect(waitForDevice(client, await client.startDevice(), clock())).rejects.toMatchObject({
			code: 'auth_cancelled',
		});
		account.deviceSteps = ['expired_token'];
		await expect(waitForDevice(client, await client.startDevice(), clock())).rejects.toMatchObject({
			code: 'auth_expired',
		});
	});

	it('stops at the code expiry without another poll', async () => {
		account.deviceSteps = ['authorization_pending'];
		account.device = { expires_in: 12, interval: 5 };
		const start = await client.startDevice();
		account.device = { expires_in: 600, interval: 5 };
		await expect(waitForDevice(client, start, clock())).rejects.toMatchObject({
			code: 'auth_expired',
		});
		expect(account.requests.filter((r) => r.path === '/auth/token')).toHaveLength(2);
	});

	it('Ctrl-C (abort) while waiting is auth_cancelled', async () => {
		account.deviceSteps = ['authorization_pending'];
		const start = await client.startDevice();
		const ctl = new AbortController();
		let slept = 0;
		const sleep = async (): Promise<void> => {
			if (++slept === 3) ctl.abort();
		};
		await expect(
			waitForDevice(client, start, { signal: ctl.signal, sleep, now: () => slept * 1000 })
		).rejects.toMatchObject({ code: 'auth_cancelled' });
	});

	it('an unknown client is auth_invalid naming MAGIC_ACCOUNT_CLIENT_ID', async () => {
		const other = new AccountClient({ accountUrl: account.url, clientId: 'nope' });
		const err = await other.startDevice().catch((e) => e);
		expect(err).toMatchObject({ code: 'auth_invalid', product: 'account' });
		expect(err.hint).toContain('MAGIC_ACCOUNT_CLIENT_ID');
	});
});

describe('revoke and transport', () => {
	it('revokes with a form body of token only; 404 is unsupported', async () => {
		const start = await client.startDevice();
		const token = await waitForDevice(client, start, clock());
		expect(await client.revoke(token.access_token)).toBe('revoked');
		expect(account.isActive(token.access_token)).toBe(false);
		expect(account.requests.at(-1)!.body).toEqual({ token: token.access_token });
		account.revokeSupported = false;
		expect(await client.revoke(token.access_token)).toBe('unsupported');
	});

	it('an unreachable Account is network with a MAGIC_ACCOUNT_URL hint', async () => {
		const dead = await startFakeAccount();
		await dead.close();
		const c = new AccountClient({ accountUrl: dead.url, clientId: 'x' });
		const err = await c.startDevice().catch((e) => e);
		expect(err).toMatchObject({ code: 'network', product: 'account' });
		expect(err.hint).toContain('MAGIC_ACCOUNT_URL');
	});

	it('reads both error shapes: { error: "code" } and { error: { code } }', async () => {
		const answers = [{ error: 'authorization_pending' }, { error: { code: 'slow_down' } }];
		const fetchStub = (async () =>
			new Response(JSON.stringify(answers.shift()), { status: 400 })) as typeof fetch;
		const c = new AccountClient({ accountUrl: 'http://x', clientId: 'x', fetch: fetchStub });
		expect(await c.pollDevice('d')).toEqual({ status: 'pending' });
		expect(await c.pollDevice('d')).toEqual({ status: 'slow_down' });
	});

	it('a token that is not magic_ is refused', async () => {
		const fetchStub = (async () =>
			new Response(JSON.stringify({ access_token: 'other_x', grant_id: 'g' }), {
				status: 200,
			})) as typeof fetch;
		const c = new AccountClient({ accountUrl: 'http://x', clientId: 'x', fetch: fetchStub });
		await expect(c.pollDevice('d')).rejects.toMatchObject({ code: 'auth_invalid' });
	});
});
