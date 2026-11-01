// The loopback listener: only GET /callback with the right state and a code ends it;
// everything else is 400 and ignored; access_denied cancels; timeout and Ctrl-C end it.

import { describe, expect, it } from 'vitest';

import { startLoopback } from '../src/loopback.js';

const exchangeTo = (value: string) => async (code: string) => `${value}:${code}`;

describe('startLoopback', () => {
	it('binds 127.0.0.1 on an ephemeral port with path /callback', async () => {
		const lb = await startLoopback({ state: 's', exchange: exchangeTo('ok') });
		expect(lb.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
		const res = await fetch(`${lb.redirectUri}?code=c1&state=s`);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
		expect(res.headers.get('content-security-policy')).toBe(
			"default-src 'none'; style-src 'unsafe-inline'"
		);
		expect(res.headers.get('cache-control')).toBe('no-store');
		const body = await res.text();
		expect(body).toMatch(/^<!doctype html>/);
		expect(body).toContain('<h1>Signed in</h1>');
		expect(body).toContain('Signed in to Magic Spells. You can close this tab.');
		expect(body).not.toContain('<script');
		await expect(lb.result).resolves.toBe('ok:c1');
	});

	it('wrong path, method, state, or a missing code: 400 and still listening', async () => {
		const lb = await startLoopback({ state: 's', exchange: exchangeTo('ok') });
		const base = lb.redirectUri.replace('/callback', '');
		const bad = await fetch(`${base}/other?code=c&state=s`);
		expect(bad.status).toBe(400);
		expect(bad.headers.get('content-type')).toBe('text/html; charset=utf-8');
		expect(await bad.text()).toContain('Bad request.');
		expect((await fetch(`${lb.redirectUri}?code=c&state=s`, { method: 'POST' })).status).toBe(400);
		expect((await fetch(`${lb.redirectUri}?code=c&state=wrong`)).status).toBe(400);
		expect((await fetch(`${lb.redirectUri}?state=s`)).status).toBe(400);
		expect((await fetch(`${lb.redirectUri}?code=c2&state=s`)).status).toBe(200);
		await expect(lb.result).resolves.toBe('ok:c2');
		// Closed afterwards.
		await expect(fetch(`${lb.redirectUri}?code=c3&state=s`)).rejects.toThrow();
	});

	it('error=access_denied with the right state is auth_cancelled', async () => {
		const lb = await startLoopback({ state: 's', exchange: exchangeTo('ok') });
		const res = await fetch(`${lb.redirectUri}?error=access_denied&state=s`);
		expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
		expect(await res.text()).toContain(
			'Sign-in cancelled. You can close this tab and return to your terminal.'
		);
		await expect(lb.result).rejects.toMatchObject({ code: 'auth_cancelled' });
	});

	it('a failed exchange answers 400 and rejects with the error', async () => {
		const lb = await startLoopback({
			state: 's',
			exchange: async () => {
				throw new Error('boom');
			},
		});
		const res = await fetch(`${lb.redirectUri}?code=c&state=s`);
		expect(res.status).toBe(400);
		expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
		expect(await res.text()).toContain('Sign-in failed. Return to your terminal for details.');
		await expect(lb.result).rejects.toMatchObject({ code: 'unknown', message: 'boom' });
	});

	it('an exchange under way is not cut off by the wait timeout', async () => {
		const lb = await startLoopback({
			state: 's',
			timeoutMs: 20,
			exchange: async (code) => {
				await new Promise((r) => setTimeout(r, 60));
				return `ok:${code}`;
			},
		});
		expect((await fetch(`${lb.redirectUri}?code=c&state=s`)).status).toBe(200);
		await expect(lb.result).resolves.toBe('ok:c');
	});

	it('a state of another length is refused like a wrong one', async () => {
		const lb = await startLoopback({ state: 'state', exchange: exchangeTo('ok') });
		expect((await fetch(`${lb.redirectUri}?code=c&state=stat`)).status).toBe(400);
		expect((await fetch(`${lb.redirectUri}?code=c&state=state`)).status).toBe(200);
		await expect(lb.result).resolves.toBe('ok:c');
	});

	it('times out as auth_expired with the --device hint', async () => {
		const lb = await startLoopback({ state: 's', exchange: exchangeTo('ok'), timeoutMs: 20 });
		const err = await lb.result.catch((e) => e);
		expect(err.code).toBe('auth_expired');
		expect(err.hint).toContain('magic login --device');
	});

	it('an abort (Ctrl-C) is auth_cancelled and closes the server', async () => {
		const ctl = new AbortController();
		const lb = await startLoopback({ state: 's', exchange: exchangeTo('ok'), signal: ctl.signal });
		ctl.abort();
		await expect(lb.result).rejects.toMatchObject({ code: 'auth_cancelled' });
		await expect(fetch(`${lb.redirectUri}?code=c&state=s`)).rejects.toThrow();
	});
});
