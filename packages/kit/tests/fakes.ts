// Fake Account and fake product servers on 127.0.0.1 for the login tests (kit and
// cli). Never production. The fakes keep the contract the real servers build to:
//
// Account: GET /auth/authorize (redirects to the loopback with code+state, or
// error=access_denied), POST /auth/token (authorization_code with PKCE S256
// verification; the device_code grant on a scripted state machine), POST /auth/device,
// POST /auth/revoke (or 404 when `revokeSupported` is false). Form-encoded only.
//
// Product: POST <path> with Bearer <grant> and { workspace?, label } -> { sessions,
// workspaces }, 401 grant_invalid / 403 no_workspaces / 404 workspace_not_found;
// DELETE <path> with Bearer <key> revokes every key from the same grant -> 204; any
// other route needs a live minted key, and `expireNext` makes the next one answer 401
// key_expired once.

import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface Recorded {
	method: string;
	path: string;
	/** Parsed form or JSON body. */
	body: Record<string, unknown>;
	query: Record<string, string>;
	contentType: string;
	authorization: string;
}

export type DeviceStep =
	'authorization_pending' | 'slow_down' | 'access_denied' | 'expired_token' | 'approve';

interface Listening {
	url: string;
	server: Server;
	close(): Promise<void>;
}

async function listen(
	handler: (req: IncomingMessage, body: string, res: ServerResponse) => void
): Promise<Listening> {
	const server = createServer((req, res) => {
		let body = '';
		req.on('data', (c) => (body += String(c)));
		req.on('end', () => handler(req, body, res));
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	return {
		url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
		server,
		close: () =>
			new Promise<void>((resolve) => {
				server.closeAllConnections();
				server.close(() => resolve());
			}),
	};
}

function send(res: ServerResponse, status: number, body?: unknown): void {
	res.writeHead(status, { 'content-type': 'application/json' });
	res.end(body === undefined ? '' : JSON.stringify(body));
}

function record(req: IncomingMessage, raw: string): Recorded {
	const url = new URL(req.url ?? '/', 'http://x');
	const contentType = req.headers['content-type'] ?? '';
	let body: Record<string, unknown> = {};
	if (contentType.startsWith('application/x-www-form-urlencoded')) {
		body = Object.fromEntries(new URLSearchParams(raw));
	} else if (raw) {
		try {
			body = JSON.parse(raw) as Record<string, unknown>;
		} catch {
			body = { raw };
		}
	}
	return {
		method: req.method ?? '',
		path: url.pathname,
		body,
		query: Object.fromEntries(url.searchParams),
		contentType,
		authorization: req.headers.authorization ?? '',
	};
}

// ============ Account ============

export interface FakeAccount extends Listening {
	clientId: string;
	requests: Recorded[];
	/** What the "person" does at /auth/authorize. */
	authorize: 'approve' | 'deny' | 'ignore';
	/** Device polls answer these in order; the last one repeats. */
	deviceSteps: DeviceStep[];
	device: { expires_in: number; interval: number };
	revokeSupported: boolean;
	/** Issued grants, and whether each is live. */
	grants: Map<string, { grant_id: string; active: boolean }>;
	isActive(token: string): boolean;
	/** Kill every grant (Account ended them). */
	expireAll(): void;
}

export async function startFakeAccount(clientId = 'magic-cli-test'): Promise<FakeAccount> {
	const codes = new Map<string, { challenge: string; redirectUri: string; clientId: string }>();
	const devices = new Map<string, { step: number; done: boolean }>();
	let fake!: FakeAccount;

	const issue = (): Record<string, unknown> => {
		const access_token = `magic_${randomBytes(18).toString('base64url')}`;
		const grant_id = `grt_${randomBytes(6).toString('hex')}`;
		fake.grants.set(access_token, { grant_id, active: true });
		return { token_type: 'Bearer', access_token, expires_in: 5184000, grant_id };
	};
	const tokenError = (res: ServerResponse, code: string): void => send(res, 400, { error: code });

	const l = await listen((req, raw, res) => {
		const r = record(req, raw);
		fake.requests.push(r);
		const form = r.body as Record<string, string>;
		const isForm = r.contentType.startsWith('application/x-www-form-urlencoded');

		if (r.method === 'GET' && r.path === '/auth/authorize') {
			const q = r.query;
			const loopback = /^http:\/\/127\.0\.0\.1:\d+\/callback$/.test(q.redirect_uri ?? '');
			if (
				q.client_id !== clientId ||
				!loopback ||
				q.code_challenge_method !== 'S256' ||
				!q.code_challenge ||
				q.scope !== 'basic' ||
				!q.state
			) {
				return send(res, 400, { error: { code: 'invalid_request' } });
			}
			if (fake.authorize === 'ignore') return send(res, 200, {});
			const target = new URL(q.redirect_uri!);
			target.searchParams.set('state', q.state);
			if (fake.authorize === 'deny') {
				target.searchParams.set('error', 'access_denied');
			} else {
				const code = randomBytes(12).toString('base64url');
				codes.set(code, { challenge: q.code_challenge, redirectUri: q.redirect_uri!, clientId });
				target.searchParams.set('code', code);
			}
			res.writeHead(303, { location: target.toString() });
			return res.end();
		}

		if (r.method === 'POST' && r.path === '/auth/device') {
			if (!isForm) return tokenError(res, 'invalid_request');
			if (form.client_id !== clientId) return tokenError(res, 'invalid_client');
			const device_code = randomBytes(16).toString('base64url');
			devices.set(device_code, { step: 0, done: false });
			return send(res, 200, {
				device_code,
				user_code: 'WDJB-MJHT',
				verification_uri: `${fake.url}/device`,
				verification_uri_complete: `${fake.url}/device?code=WDJB-MJHT`,
				...fake.device,
			});
		}

		if (r.method === 'POST' && r.path === '/auth/token') {
			if (!isForm) return tokenError(res, 'invalid_request');
			if (form.client_id !== clientId) return tokenError(res, 'invalid_client');
			if (form.grant_type === 'authorization_code') {
				const c = codes.get(form.code ?? '');
				codes.delete(form.code ?? '');
				const verified =
					c &&
					c.redirectUri === form.redirect_uri &&
					createHash('sha256')
						.update(form.code_verifier ?? '')
						.digest('base64url') === c.challenge;
				return verified ? send(res, 200, issue()) : tokenError(res, 'invalid_grant');
			}
			if (form.grant_type === 'urn:ietf:params:oauth:grant-type:device_code') {
				const d = devices.get(form.device_code ?? '');
				if (!d || d.done) return tokenError(res, 'invalid_grant');
				const step = fake.deviceSteps[Math.min(d.step, fake.deviceSteps.length - 1)]!;
				d.step++;
				if (step === 'approve') {
					d.done = true;
					return send(res, 200, issue());
				}
				if (step === 'access_denied' || step === 'expired_token') d.done = true;
				return tokenError(res, step);
			}
			return tokenError(res, 'unsupported_grant_type');
		}

		if (r.method === 'POST' && r.path === '/auth/revoke') {
			if (!fake.revokeSupported) return send(res, 404, { error: { code: 'not_found' } });
			const g = fake.grants.get(form.token ?? '');
			if (g) g.active = false;
			return send(res, 200, {});
		}

		if (r.method === 'HEAD' || (r.method === 'GET' && r.path === '/')) return send(res, 200, {});
		send(res, 404, { error: { code: 'not_found' } });
	});

	fake = {
		...l,
		clientId,
		requests: [],
		authorize: 'approve',
		deviceSteps: ['approve'],
		device: { expires_in: 600, interval: 5 },
		revokeSupported: true,
		grants: new Map(),
		isActive: (token) => fake.grants.get(token)?.active === true,
		expireAll: () => {
			for (const g of fake.grants.values()) g.active = false;
		},
	};
	return fake;
}

/** A "browser" that follows Account's redirect to the loopback, like a person approving. */
export function fakeBrowser(opened: string[] = []): (url: string) => Promise<boolean> {
	return async (url) => {
		opened.push(url);
		// Device verification pages are for people; only the authorize URL is followed.
		if (url.includes('/auth/authorize')) void fetch(url, { redirect: 'follow' }).catch(() => {});
		return true;
	};
}

// ============ Product ============

export interface FakeWorkspace {
	id: string;
	handle: string;
	name: string;
	role: string;
}

export interface FakeProductOptions {
	id: string;
	/** Key prefix, e.g. `dmk_`. */
	prefix: string;
	/** Sessions route, e.g. `/v1/cli/sessions`. */
	path: string;
	account: FakeAccount;
	workspaces: FakeWorkspace[];
	/** Extra JSON routes (`GET /v1/me` -> body) answered for a live key. */
	routes?: Record<string, unknown>;
}

export interface FakeProduct extends Listening {
	requests: Recorded[];
	workspaces: FakeWorkspace[];
	keys: Map<string, { grant: string; handle: string; revoked: boolean }>;
	/** The next authenticated request answers 401 key_expired, once. */
	expireNext: boolean;
	/** The sessions route answers 503 (product down). */
	down: boolean;
	liveKeys(): string[];
}

export async function startFakeProduct(opts: FakeProductOptions): Promise<FakeProduct> {
	let fake!: FakeProduct;
	const bearer = (r: Recorded): string => r.authorization.replace(/^Bearer /, '');
	const mint = (grant: string, w: FakeWorkspace): Record<string, unknown> => {
		const key = `${opts.prefix}${randomBytes(4).toString('hex')}_${randomBytes(12).toString('hex')}`;
		fake.keys.set(key, { grant, handle: w.handle, revoked: false });
		return {
			product: opts.id,
			key,
			key_id: `key_${randomBytes(4).toString('hex')}`,
			workspace: { id: w.id, handle: w.handle, name: w.name },
			role: w.role,
			expires_at: new Date(Date.now() + 86_400_000).toISOString(),
			source: 'account',
		};
	};

	const l = await listen((req, raw, res) => {
		const r = record(req, raw);
		fake.requests.push(r);
		if (r.method === 'HEAD') return send(res, 404);

		if (r.path === opts.path && r.method === 'POST') {
			if (fake.down) return send(res, 503, { error: { code: 'unavailable', message: 'down' } });
			const grant = bearer(r);
			if (!opts.account.isActive(grant)) {
				return send(res, 401, { error: { code: 'grant_invalid', message: 'grant invalid' } });
			}
			if (fake.workspaces.length === 0) {
				return send(res, 403, { error: { code: 'no_workspaces', message: 'no workspaces' } });
			}
			const want = typeof r.body.workspace === 'string' ? r.body.workspace : undefined;
			const chosen = want ? fake.workspaces.filter((w) => w.handle === want) : fake.workspaces;
			if (chosen.length === 0) {
				return send(res, 404, {
					error: { code: 'workspace_not_found', message: 'no such workspace' },
				});
			}
			return send(res, 200, {
				sessions: chosen.map((w) => mint(grant, w)),
				workspaces: fake.workspaces,
			});
		}

		const key = fake.keys.get(bearer(r));
		if (!key || key.revoked) {
			return send(res, 401, { error: { code: 'unauthorized', message: 'bad key' } });
		}
		if (r.path === opts.path && r.method === 'DELETE') {
			for (const k of fake.keys.values()) if (k.grant === key.grant) k.revoked = true;
			return send(res, 204);
		}
		if (fake.expireNext) {
			fake.expireNext = false;
			key.revoked = true;
			return send(res, 401, { error: { code: 'key_expired', message: 'key expired' } });
		}
		const body = opts.routes?.[`${r.method} ${r.path}`];
		if (body === undefined)
			return send(res, 404, { error: { code: 'not_found', message: r.path } });
		send(
			res,
			200,
			typeof body === 'function' ? (body as (h: string) => unknown)(key.handle) : body
		);
	});

	fake = {
		...l,
		requests: [],
		workspaces: opts.workspaces,
		keys: new Map(),
		expireNext: false,
		down: false,
		liveKeys: () => [...fake.keys].filter(([, k]) => !k.revoked).map(([key]) => key),
	};
	return fake;
}
