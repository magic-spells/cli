// The Account client (FEATURE-DEVICE-LOGIN, API-ACCOUNT-DEVICE-AUTHORIZATION): PKCE and
// the authorize URL for the loopback flow, the code exchange, the device flow (start and
// poll), and grant revocation. Form-encoded bodies, like Account's native clients; no
// SDK. The grant is Account's opaque `magic_…` token: identity only, never inspected
// here beyond its prefix (DATATYPE-ACCOUNT-CLI-GRANT, DOC-SECURITY).
//
// Errors land on the kit envelope with product `account`: auth_invalid / auth_expired /
// auth_cancelled (exit 3), network, rate_limited, product_unavailable.

import { createHash, randomBytes } from 'node:crypto';

import { ACCOUNT_CLIENT_ID_PLACEHOLDER } from './config.js';
import { MagicError, isNetworkError } from './errors.js';

/** Errors from Account carry this product id. */
export const ACCOUNT_PRODUCT = 'account';
/** Every Account cli grant starts with this. */
export const GRANT_PREFIX = 'magic_';
export const DEVICE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';
/** Account's absolute grant lifetime when the answer omits expires_in (60 days). */
const DEFAULT_GRANT_SECONDS = 60 * 24 * 60 * 60;

export type Fetch = typeof fetch;

export interface Pkce {
	/** 32 random bytes, base64url: stays on this machine until the exchange. */
	verifier: string;
	/** base64url(SHA-256(verifier)), sent with code_challenge_method=S256. */
	challenge: string;
}

export function createPkce(bytes: Buffer = randomBytes(32)): Pkce {
	const verifier = bytes.toString('base64url');
	return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

/** The loopback flow's `state`: 24 random bytes, base64url. */
export function randomState(): string {
	return randomBytes(24).toString('base64url');
}

export interface AuthorizeParams {
	accountUrl: string;
	clientId: string;
	redirectUri: string;
	state: string;
	challenge: string;
}

/** `GET /auth/authorize?client_id&redirect_uri&state&code_challenge&code_challenge_method=S256&scope=basic`. */
export function authorizeUrl(p: AuthorizeParams): string {
	const url = new URL('/auth/authorize', p.accountUrl);
	url.searchParams.set('client_id', p.clientId);
	url.searchParams.set('redirect_uri', p.redirectUri);
	url.searchParams.set('state', p.state);
	url.searchParams.set('code_challenge', p.challenge);
	url.searchParams.set('code_challenge_method', 'S256');
	url.searchParams.set('scope', 'basic');
	return url.toString();
}

/** Account's grant answer on `POST /auth/token`. */
export interface AccountToken {
	token_type: 'Bearer';
	access_token: string;
	/** Seconds; 5184000 (60 days) for a cli grant. */
	expires_in: number;
	grant_id: string;
}

/** `POST /auth/device`. */
export interface DeviceStart {
	device_code: string;
	user_code: string;
	verification_uri: string;
	verification_uri_complete?: string;
	/** Seconds the code lives (600). */
	expires_in: number;
	/** Seconds between polls (5). */
	interval: number;
}

export type DevicePoll =
	{ status: 'approved'; token: AccountToken } | { status: 'pending' } | { status: 'slow_down' };

export interface AccountClientOptions {
	accountUrl: string;
	clientId: string;
	fetch?: Fetch;
}

export class AccountClient {
	readonly accountUrl: string;
	readonly clientId: string;
	private readonly fetch: Fetch;

	constructor(opts: AccountClientOptions) {
		if (!opts.clientId || opts.clientId === ACCOUNT_CLIENT_ID_PLACEHOLDER) {
			throw new MagicError('usage', 'This build of magic has no Account client id.', {
				product: ACCOUNT_PRODUCT,
				hint: 'Set MAGIC_ACCOUNT_CLIENT_ID to the magic application’s client id.',
			});
		}
		this.accountUrl = opts.accountUrl;
		this.clientId = opts.clientId;
		this.fetch = opts.fetch ?? fetch;
	}

	/** Exchange a loopback `code` for the grant (`grant_type=authorization_code`). */
	async exchangeCode(p: {
		code: string;
		verifier: string;
		redirectUri: string;
		signal?: AbortSignal;
	}): Promise<AccountToken> {
		const res = await this.post(
			'/auth/token',
			{
				grant_type: 'authorization_code',
				code: p.code,
				code_verifier: p.verifier,
				client_id: this.clientId,
				redirect_uri: p.redirectUri,
			},
			p.signal
		);
		if (!res.ok) throw tokenError(res.status, res.code);
		return readToken(res.body);
	}

	/** Start the device flow (`POST /auth/device`). */
	async startDevice(signal?: AbortSignal): Promise<DeviceStart> {
		const res = await this.post(
			'/auth/device',
			{ client_id: this.clientId, scope: 'basic' },
			signal
		);
		if (!res.ok) throw tokenError(res.status, res.code);
		const b = res.body as Partial<DeviceStart>;
		if (
			typeof b.device_code !== 'string' ||
			typeof b.user_code !== 'string' ||
			typeof b.verification_uri !== 'string'
		) {
			throw new MagicError('unknown', 'Account answered the device request without a code.', {
				product: ACCOUNT_PRODUCT,
			});
		}
		return {
			device_code: b.device_code,
			user_code: b.user_code,
			verification_uri: b.verification_uri,
			...(typeof b.verification_uri_complete === 'string'
				? { verification_uri_complete: b.verification_uri_complete }
				: {}),
			expires_in: positive(b.expires_in, 600),
			interval: positive(b.interval, 5),
		};
	}

	/**
	 * One device poll. Pending and slow_down come back as values; access_denied
	 * (auth_cancelled) and expired_token (auth_expired) throw.
	 */
	async pollDevice(deviceCode: string, signal?: AbortSignal): Promise<DevicePoll> {
		const res = await this.post(
			'/auth/token',
			{ grant_type: DEVICE_GRANT_TYPE, device_code: deviceCode, client_id: this.clientId },
			signal
		);
		if (res.ok) return { status: 'approved', token: readToken(res.body) };
		if (res.code === 'authorization_pending') return { status: 'pending' };
		if (res.code === 'slow_down') return { status: 'slow_down' };
		throw tokenError(res.status, res.code);
	}

	/**
	 * Revoke the grant (`POST /auth/revoke token=…`). `unsupported` when this Account
	 * has no revoke endpoint (404/405); other failures throw.
	 */
	async revoke(token: string, signal?: AbortSignal): Promise<'revoked' | 'unsupported'> {
		const res = await this.post('/auth/revoke', { token }, signal);
		if (res.ok) return 'revoked';
		if (res.status === 404 || res.status === 405) return 'unsupported';
		throw tokenError(res.status, res.code);
	}

	private async post(
		path: string,
		form: Record<string, string>,
		signal?: AbortSignal
	): Promise<{ ok: boolean; status: number; code?: string; body: unknown }> {
		let res: Response;
		try {
			res = await this.fetch(new URL(path, this.accountUrl), {
				method: 'POST',
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
					accept: 'application/json',
				},
				body: new URLSearchParams(form).toString(),
				...(signal ? { signal } : {}),
			});
		} catch (err) {
			throw transportError(err, signal);
		}
		const text = await res.text().catch(() => '');
		let body: unknown = null;
		try {
			body = text ? JSON.parse(text) : null;
		} catch {
			body = null;
		}
		return { ok: res.ok, status: res.status, code: errorCode(body), body };
	}
}

export interface DeviceWaitOptions {
	signal?: AbortSignal;
	/** Abortable sleep; injected in tests. */
	sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
	now?: () => number;
	/** Called about once a second with the seconds left on the code. */
	onTick?: (secondsLeft: number) => void;
}

/**
 * Poll until the person approves: honours `interval`, adds 5 s on slow_down, stops at
 * the code's expiry (auth_expired). An abort (Ctrl-C) is auth_cancelled; nothing is
 * stored here either way.
 */
export async function waitForDevice(
	client: AccountClient,
	start: DeviceStart,
	opts: DeviceWaitOptions = {}
): Promise<AccountToken> {
	const sleep = opts.sleep ?? abortableSleep;
	const now = opts.now ?? Date.now;
	const deadline = now() + start.expires_in * 1000;
	let interval = start.interval * 1000;
	for (;;) {
		// Wait the interval in one-second steps so the countdown moves.
		const until = now() + interval;
		while (now() < until) {
			if (opts.signal?.aborted) throw cancelledError();
			opts.onTick?.(Math.max(0, Math.ceil((deadline - now()) / 1000)));
			await sleep(Math.min(1000, until - now()), opts.signal).catch((err: unknown) => {
				throw opts.signal?.aborted ? cancelledError() : err;
			});
		}
		if (opts.signal?.aborted) throw cancelledError();
		if (now() >= deadline) throw expiredCodeError();
		const poll = await client.pollDevice(start.device_code, opts.signal);
		if (poll.status === 'approved') return poll.token;
		if (poll.status === 'slow_down') interval += 5000;
	}
}

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) return reject(cancelledError());
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		const onAbort = (): void => {
			clearTimeout(timer);
			reject(cancelledError());
		};
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}

export function cancelledError(): MagicError {
	return new MagicError('auth_cancelled', 'Login cancelled.', { product: ACCOUNT_PRODUCT });
}

function expiredCodeError(): MagicError {
	return new MagicError('auth_expired', 'The code expired.', {
		product: ACCOUNT_PRODUCT,
		hint: 'Run `magic login` again.',
	});
}

/** Account answers `{ error: "<code>" }` (RFC 6749) or `{ error: { code } }`; read both. */
function errorCode(body: unknown): string | undefined {
	if (!body || typeof body !== 'object' || !('error' in body)) return undefined;
	const e = (body as { error: unknown }).error;
	if (typeof e === 'string') return e;
	if (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') {
		return (e as { code: string }).code;
	}
	return undefined;
}

function tokenError(status: number, code: string | undefined): MagicError {
	const product = ACCOUNT_PRODUCT;
	switch (code) {
		case 'access_denied':
			return cancelledError();
		case 'expired_token':
			return expiredCodeError();
		case 'invalid_client':
			return new MagicError('auth_invalid', 'Account does not know this client.', {
				product,
				hint: 'Check MAGIC_ACCOUNT_CLIENT_ID and MAGIC_ACCOUNT_URL.',
			});
		case 'invalid_grant':
			return new MagicError('auth_invalid', 'Account refused the sign-in code.', {
				product,
				hint: 'Run `magic login` again.',
			});
	}
	if (status === 429 || code === 'slow_down' || code === 'rate_limited') {
		return new MagicError('rate_limited', 'Account is rate limiting sign-ins.', {
			product,
			hint: 'Wait a minute and try again.',
		});
	}
	if (status >= 500) {
		return new MagicError('product_unavailable', `Account is unavailable (HTTP ${status}).`, {
			product,
		});
	}
	return new MagicError(
		'auth_invalid',
		`Account refused the request (HTTP ${status}${code ? `, ${code}` : ''}).`,
		{ product }
	);
}

function transportError(err: unknown, signal?: AbortSignal): MagicError {
	if (signal?.aborted) return cancelledError();
	const message = err instanceof Error ? err.message : String(err);
	const cause = err instanceof Error && err.cause instanceof Error ? `: ${err.cause.message}` : '';
	if (err instanceof Error && !isNetworkError(err)) {
		return new MagicError('unknown', message, { product: ACCOUNT_PRODUCT });
	}
	return new MagicError('network', `Cannot reach Account (${message}${cause}).`, {
		product: ACCOUNT_PRODUCT,
		hint: 'Check MAGIC_ACCOUNT_URL and your network connection.',
	});
}

/** The grant from a token answer; refuses anything that is not a `magic_` token. */
function readToken(body: unknown): AccountToken {
	const b = (body ?? {}) as Partial<AccountToken>;
	if (typeof b.access_token !== 'string' || !b.access_token.startsWith(GRANT_PREFIX)) {
		throw new MagicError('auth_invalid', 'Account answered without a magic grant.', {
			product: ACCOUNT_PRODUCT,
			hint: 'Check MAGIC_ACCOUNT_URL points at Magic Spells Account.',
		});
	}
	return {
		token_type: 'Bearer',
		access_token: b.access_token,
		expires_in: positive(b.expires_in, DEFAULT_GRANT_SECONDS),
		grant_id: typeof b.grant_id === 'string' ? b.grant_id : '',
	};
}

function positive(v: unknown, fallback: number): number {
	return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback;
}
