// Unit tests for `magic pyramid login` (src/login.ts). Side effects are injected via
// a fake AuthIO, so NO real keychain / `security` call happens. pyramid-cli's
// set-key / show-key / logout tests moved to the kit's credentials tests.

import { request } from 'node:http';
import { describe, it, expect } from 'vitest';

import { runLogin, type AuthIO } from '../src/login.js';

const KEY = 'pyk_ab23cd45_0123456789abcdef0123456789abcdef';
const SECRET = '0123456789abcdef0123456789abcdef';

function fakeIO(stored: string | null = null, overrides: Partial<AuthIO> = {}) {
	const lines: string[] = [];
	let key = stored;
	return {
		io: {
			out: (l: string) => lines.push(l),
			setKey: async (k: string) => {
				key = k;
			},
			openBrowser: () => true,
			env: {},
			randomState: () => 'test-state',
			loginTimeoutMs: 100,
			...overrides,
		} satisfies AuthIO,
		lines,
		get stored() {
			return key;
		},
	};
}

function callbackURL(loginURL: string): URL {
	return new URL(new URL(loginURL).searchParams.get('redirect_uri') ?? '');
}

/** Send a request to the loopback listener; resolves with the status code. */
function send(url: URL, method: string, body?: string): Promise<number> {
	return new Promise((resolve, reject) => {
		const req = request(
			url,
			{
				method,
				headers: body == null ? {} : { 'content-type': 'application/x-www-form-urlencoded' },
			},
			(res) => {
				res.resume();
				res.on('end', () => resolve(res.statusCode ?? 0));
			}
		);
		req.on('error', reject);
		req.end(body);
	});
}

/** POST the urlencoded form Pyramid web's /auth/cli sends. */
function callbackFromLoginURL(
	loginURL: string,
	params: Record<string, string>,
	useState: string | null = new URL(loginURL).searchParams.get('state')
): Promise<number> {
	const form = new URLSearchParams();
	if (useState != null) form.set('state', useState);
	for (const [k, v] of Object.entries(params)) form.set(k, v);
	return send(callbackURL(loginURL), 'POST', form.toString());
}

describe('runLogin', () => {
	it('stores the callback key and never prints the full secret', async () => {
		const f = fakeIO(null, {
			openBrowser: async (url) => {
				await callbackFromLoginURL(url, { key: KEY });
				return true;
			},
		});

		expect(await runLogin([], f.io)).toBe(0);
		expect(f.stored).toBe(KEY);
		const output = f.lines.join(' ');
		expect(output).toContain('pyk_ab23cd45_…cdef');
		expect(output).not.toContain(SECRET);
	});

	it('refuses a GET with the key in the query string and never reads it', async () => {
		let status = 0;
		const f = fakeIO(null, {
			openBrowser: async (url) => {
				const callback = callbackURL(url);
				callback.searchParams.set('state', 'test-state');
				callback.searchParams.set('key', KEY);
				status = await send(callback, 'GET');
				return true;
			},
		});

		expect(await runLogin([], f.io)).toBe(1);
		expect(status).toBe(405);
		expect(f.stored).toBeNull();
		expect(f.lines.join(' ')).not.toContain(SECRET);
	});

	it('rejects a POST with the wrong state', async () => {
		let status = 0;
		const f = fakeIO(null, {
			openBrowser: async (url) => {
				status = await callbackFromLoginURL(url, { key: KEY }, 'wrong-state');
				return true;
			},
		});

		expect(await runLogin([], f.io)).toBe(1);
		expect(status).toBe(400);
		expect(f.stored).toBeNull();
		expect(f.lines.join(' ')).toContain('invalid state');
	});

	it('rejects an oversized callback body', async () => {
		let status = 0;
		const f = fakeIO(null, {
			openBrowser: async (url) => {
				status = await callbackFromLoginURL(url, { key: KEY, name: 'x'.repeat(16 * 1024) });
				return true;
			},
		});

		expect(await runLogin([], f.io)).toBe(1);
		expect(status).toBe(413);
		expect(f.stored).toBeNull();
	});

	it('handles browser cancellation without storing a key', async () => {
		const f = fakeIO(null, {
			openBrowser: async (url) => {
				await callbackFromLoginURL(url, { error: 'access_denied' });
				return true;
			},
		});

		expect(await runLogin([], f.io)).toBe(1);
		expect(f.stored).toBeNull();
		expect(f.lines.join(' ')).toContain('cancelled');
	});

	it('prints the login URL when browser opening fails and still accepts manual completion', async () => {
		let seenURL = '';
		const f = fakeIO(null, {
			openBrowser: (url) => {
				seenURL = url;
				setImmediate(() => {
					void callbackFromLoginURL(url, { key: KEY });
				});
				return false;
			},
		});

		expect(
			await runLogin(['--web-url', 'http://localhost:5173', '--name', 'Local CLI'], f.io)
		).toBe(0);
		expect(f.stored).toBe(KEY);
		const login = new URL(seenURL);
		expect(login.origin).toBe('http://localhost:5173');
		expect(login.pathname).toBe('/auth/cli');
		expect(login.searchParams.get('name')).toBe('Local CLI');
		expect(f.lines.join(' ')).toContain(seenURL);
	});

	it('--help prints usage and exits 0 without opening the browser', async () => {
		const f = fakeIO(null, {
			openBrowser: () => {
				throw new Error('must not open');
			},
		});
		expect(await runLogin(['--help'], f.io)).toBe(0);
		expect(f.lines[0]).toMatch(/^usage: magic pyramid login/);
	});

	it('times out if no callback arrives', async () => {
		const f = fakeIO(null, {
			openBrowser: () => true,
			loginTimeoutMs: 5,
		});

		expect(await runLogin([], f.io)).toBe(1);
		expect(f.stored).toBeNull();
		expect(f.lines.join(' ')).toContain('timed out');
	});
});
