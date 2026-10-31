// The loopback callback for browser sign-in (FLOW-LOGIN-LOOPBACK, DOC-SECURITY "Loopback
// login"), from the browser-handoff server pyramid-cli used: an HTTP server on
// 127.0.0.1, an ephemeral port, one path.
//
// It accepts exactly one `GET /callback?code=…&state=…` carrying the expected state,
// hands the code to `exchange` at once (the code lives 30 s), answers the browser
// "You can close this tab", and closes. Any other path, method or state gets 400 and
// is otherwise ignored, so a stray request cannot end the login. `error=access_denied`
// with the right state is a cancel. Two minutes without a callback is auth_expired with
// a hint to use the device flow; an abort (Ctrl-C) is auth_cancelled.

import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { ACCOUNT_PRODUCT, cancelledError } from './account.js';
import { MagicError, toMagicError } from './errors.js';

export const LOOPBACK_TIMEOUT_MS = 2 * 60 * 1000;
/** Account's authorization codes live 30 s; the exchange must finish inside that. */
export const CODE_EXCHANGE_TIMEOUT_MS = 30 * 1000;

export interface LoopbackOptions<T> {
	/** The `state` sent to /auth/authorize. */
	state: string;
	/** Exchange the code; `signal` ends after CODE_EXCHANGE_TIMEOUT_MS or on abort. */
	exchange: (code: string, redirectUri: string, signal: AbortSignal) => Promise<T>;
	timeoutMs?: number;
	signal?: AbortSignal;
}

export interface Loopback<T> {
	/** `http://127.0.0.1:<port>/callback`. */
	redirectUri: string;
	/** The exchange's result, or the reason the login ended. The server is closed either way. */
	result: Promise<T>;
}

export async function startLoopback<T>(opts: LoopbackOptions<T>): Promise<Loopback<T>> {
	let settle!: { resolve: (v: T) => void; reject: (e: MagicError) => void };
	const result = new Promise<T>((resolve, reject) => (settle = { resolve, reject }));
	// The caller awaits `result` after opening the browser; never an unhandled rejection.
	result.catch(() => {});
	let done = false;
	let exchanging = false;
	const server = createServer((req, res) => void handle(req, res));

	const finish = (outcome: { value: T } | { error: MagicError }): void => {
		if (done) return;
		done = true;
		clearTimeout(timer);
		opts.signal?.removeEventListener('abort', onAbort);
		server.close();
		// Replies carry `connection: close`; this drops any idle preconnect.
		server.closeIdleConnections();
		if ('value' in outcome) settle.resolve(outcome.value);
		else settle.reject(outcome.error);
	};

	const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
		const url = new URL(req.url ?? '/', 'http://127.0.0.1');
		const state = url.searchParams.get('state');
		if (done || exchanging || req.method !== 'GET' || url.pathname !== '/callback') {
			return reply(res, 400, 'Bad request.');
		}
		if (!sameState(state, opts.state)) return reply(res, 400, 'Bad request.');

		const error = url.searchParams.get('error');
		if (error) {
			reply(res, 200, 'Sign-in cancelled. You can close this tab and return to your terminal.');
			return finish({
				error:
					error === 'access_denied'
						? cancelledError()
						: new MagicError('auth_invalid', `Account refused the sign-in (${error}).`, {
								product: ACCOUNT_PRODUCT,
							}),
			});
		}
		const code = url.searchParams.get('code');
		if (!code) return reply(res, 400, 'Bad request.');

		exchanging = true;
		// The code is spent once presented: the 2-minute wait must not end the login
		// mid-exchange and orphan the grant Account is issuing.
		clearTimeout(timer);
		const signals = [AbortSignal.timeout(CODE_EXCHANGE_TIMEOUT_MS)];
		if (opts.signal) signals.push(opts.signal);
		try {
			const value = await opts.exchange(code, redirectUri, AbortSignal.any(signals));
			reply(res, 200, 'Signed in to Magic Spells. You can close this tab.');
			finish({ value });
		} catch (err) {
			reply(res, 400, 'Sign-in failed. Return to your terminal for details.');
			finish({ error: toMagicError(err, { product: ACCOUNT_PRODUCT }) });
		}
	};

	const onAbort = (): void => finish({ error: cancelledError() });
	const timer = setTimeout(
		() =>
			finish({
				error: new MagicError('auth_expired', 'Sign-in timed out waiting for the browser.', {
					product: ACCOUNT_PRODUCT,
					hint: 'Run `magic login --device` to sign in with a code instead.',
				}),
			}),
		opts.timeoutMs ?? LOOPBACK_TIMEOUT_MS
	);
	timer.unref?.();

	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			server.off('error', reject);
			resolve();
		});
	}).catch((err: unknown) => {
		clearTimeout(timer);
		throw toMagicError(err, { product: ACCOUNT_PRODUCT });
	});
	const redirectUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}/callback`;
	if (opts.signal?.aborted) onAbort();
	else opts.signal?.addEventListener('abort', onAbort, { once: true });
	return { redirectUri, result };
}

/** Constant-time state check (DOC-SECURITY "Loopback login"). */
function sameState(got: string | null, want: string): boolean {
	if (got === null) return false;
	const a = Buffer.from(got);
	const b = Buffer.from(want);
	return a.length === b.length && timingSafeEqual(a, b);
}

function reply(res: ServerResponse, status: number, text: string): void {
	res.writeHead(status, {
		'content-type': 'text/plain; charset=utf-8',
		'cache-control': 'no-store',
		connection: 'close',
	});
	res.end(`${text}\n`);
}
