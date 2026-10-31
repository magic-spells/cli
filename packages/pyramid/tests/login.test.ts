// Unit tests for `magic pyramid login` (src/login.ts). Side effects are injected via
// a fake AuthIO, so NO real keychain / `security` call happens. pyramid-cli's
// set-key / show-key / logout tests moved to the kit's credentials tests.

import { get } from 'node:http';
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

function callbackFromLoginURL(
	loginURL: string,
	params: Record<string, string>,
	useState: string | null = new URL(loginURL).searchParams.get('state')
): Promise<void> {
	const login = new URL(loginURL);
	const callback = new URL(login.searchParams.get('redirect_uri') ?? '');
	if (useState != null) callback.searchParams.set('state', useState);
	for (const [k, v] of Object.entries(params)) callback.searchParams.set(k, v);

	return new Promise((resolve, reject) => {
		const req = get(callback, (res) => {
			res.resume();
			res.on('end', resolve);
		});
		req.on('error', reject);
	});
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

	it('rejects a callback with a mismatched state', async () => {
		const f = fakeIO(null, {
			openBrowser: async (url) => {
				await callbackFromLoginURL(url, { key: KEY }, 'wrong-state');
				return true;
			},
		});

		expect(await runLogin([], f.io)).toBe(1);
		expect(f.stored).toBeNull();
		expect(f.lines.join(' ')).toContain('invalid state');
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
