// The error envelope and exit table shared by every product (DATATYPE-ERROR-ENVELOPE,
// DECISION-OPERATION-CONTRACT). Callers act on `code`, never on `message`.
//
// Generalised from pyramid-cli's McpError: the product is carried on the error, the
// per-noun `*_not_found` and `ambiguous_*_name` families collapse into `not_found` and
// `ambiguous_name` with `details.kind`, and every code has an exit class.

export type MagicErrorCode =
	| 'usage'
	| 'not_logged_in'
	| 'auth_invalid'
	| 'auth_expired'
	| 'permission_denied'
	| 'not_found'
	| 'ambiguous_name'
	| 'validation_failed'
	| 'conflict'
	| 'diagnostics'
	| 'destructive_action_disabled'
	| 'rate_limited'
	| 'network'
	| 'product_unavailable'
	| 'unknown';

/** Every code, for exhaustive tests and docs. */
export const MAGIC_ERROR_CODES: readonly MagicErrorCode[] = [
	'usage',
	'not_logged_in',
	'auth_invalid',
	'auth_expired',
	'permission_denied',
	'not_found',
	'ambiguous_name',
	'validation_failed',
	'conflict',
	'diagnostics',
	'destructive_action_disabled',
	'rate_limited',
	'network',
	'product_unavailable',
	'unknown',
];

/** The shell's own errors carry this product id; products use their own id. */
export const SHELL_PRODUCT = 'magic';

export interface MagicErrorShape {
	code: MagicErrorCode;
	message: string;
	hint?: string;
	candidates?: string[];
	product: string;
	details?: Record<string, unknown>;
}

export interface MagicErrorOptions {
	product?: string;
	hint?: string;
	candidates?: string[];
	details?: Record<string, unknown>;
}

export class MagicError extends Error {
	readonly code: MagicErrorCode;
	readonly product: string;
	readonly hint?: string;
	readonly candidates?: string[];
	readonly details?: Record<string, unknown>;

	constructor(code: MagicErrorCode, message: string, opts: MagicErrorOptions = {}) {
		super(message);
		this.name = 'MagicError';
		this.code = code;
		this.product = opts.product ?? SHELL_PRODUCT;
		if (opts.hint !== undefined) this.hint = opts.hint;
		if (opts.candidates !== undefined) this.candidates = opts.candidates;
		if (opts.details !== undefined) this.details = opts.details;
		Object.setPrototypeOf(this, MagicError.prototype);
	}

	/** The inner envelope: what `{ error: … }` wraps on stderr and in MCP results. */
	toJSON(): MagicErrorShape {
		const out: MagicErrorShape = { code: this.code, message: this.message, product: this.product };
		if (this.hint !== undefined) out.hint = this.hint;
		if (this.candidates !== undefined) out.candidates = this.candidates;
		if (this.details !== undefined) out.details = this.details;
		return out;
	}
}

export function isMagicError(e: unknown): e is MagicError {
	return e instanceof MagicError;
}

/** Exit status by error class. Scripts branch on these; never renumber. */
export function exitCodeFor(code: MagicErrorCode): number {
	switch (code) {
		case 'usage':
			return 2;
		case 'not_logged_in':
		case 'auth_invalid':
		case 'auth_expired':
			return 3;
		case 'permission_denied':
			return 4;
		case 'not_found':
			return 5;
		case 'ambiguous_name':
			return 6;
		case 'validation_failed':
		case 'conflict':
		case 'diagnostics':
			return 7;
		case 'destructive_action_disabled':
			return 8;
		case 'rate_limited':
			return 9;
		case 'network':
			return 10;
		case 'product_unavailable':
			return 11;
		case 'unknown':
			return 1;
		default: {
			// A new code must pick a class before it compiles.
			const never: never = code;
			void never;
			return 1;
		}
	}
}

/** An MCP tool result carrying the envelope. Surfaces never throw to the transport. */
export function toToolError(e: MagicError): {
	content: { type: 'text'; text: string }[];
	isError: true;
} {
	return {
		content: [{ type: 'text', text: JSON.stringify({ error: e.toJSON() }) }],
		isError: true,
	};
}

// ============ HTTP envelope -> MagicError ============

export interface HttpErrorOptions {
	product: string;
	/** Hint for 401s, e.g. where to get a new key. */
	authHint?: string;
	/**
	 * Nouns this API can report as missing, most specific first. A 404 whose envelope
	 * code or message names one gets `details.kind`; otherwise no kind.
	 */
	notFoundKinds?: readonly string[];
	/** Display name for the fallback message ("Pyramid request failed (HTTP 500)"). */
	title?: string;
}

/**
 * Read `{ error: { code, message, details } }` defensively. `details.field` is lifted
 * because it is the one detail a caller cannot recover any other way: which field of
 * a multi-field write the server rejected.
 */
function readEnvelope(body: unknown): { code?: string; message?: string; field?: string } {
	if (!body || typeof body !== 'object' || !('error' in body)) return {};
	const err = (body as { error?: unknown }).error;
	if (!err || typeof err !== 'object') return {};
	const e = err as { code?: unknown; message?: unknown; details?: unknown };
	const rawField =
		e.details && typeof e.details === 'object'
			? (e.details as Record<string, unknown>).field
			: undefined;
	return {
		code: typeof e.code === 'string' ? e.code : undefined,
		message: typeof e.message === 'string' ? e.message : undefined,
		field: typeof rawField === 'string' && rawField.length > 0 ? rawField : undefined,
	};
}

/**
 * Map a non-2xx status and parsed body to a MagicError:
 * 401 auth_invalid (auth_expired when the envelope says so), 403 permission_denied,
 * 404 not_found, 400/422 validation_failed (+ details.field), 409 conflict,
 * 429 rate_limited, anything else unknown.
 */
export function mapHttpError(status: number, body: unknown, opts: HttpErrorOptions): MagicError {
	const env = readEnvelope(body);
	const product = opts.product;
	const message = env.message ?? `${opts.title ?? product} request failed (HTTP ${status}).`;

	if (status === 401) {
		const expired = `${env.code ?? ''} ${env.message ?? ''}`.toLowerCase().includes('expired');
		return new MagicError(expired ? 'auth_expired' : 'auth_invalid', message, {
			product,
			...(opts.authHint ? { hint: opts.authHint } : {}),
		});
	}
	if (status === 403) return new MagicError('permission_denied', message, { product });
	if (status === 404) {
		const hay = `${env.code ?? ''} ${env.message ?? ''}`.toLowerCase();
		const kind = opts.notFoundKinds?.find((k) => hay.includes(k));
		return new MagicError('not_found', message, {
			product,
			...(kind ? { details: { kind } } : {}),
		});
	}
	if (status === 400 || status === 422) {
		return env.field === undefined
			? new MagicError('validation_failed', message, { product })
			: new MagicError('validation_failed', message, {
					product,
					hint: `The server rejected the \`${env.field}\` field.`,
					details: { field: env.field },
				});
	}
	if (status === 409) {
		return new MagicError('conflict', message, {
			product,
			hint: 'The resource changed since you last read it — reread it and try again.',
		});
	}
	if (status === 429) {
		return new MagicError('rate_limited', message, { product, hint: 'Slow down and retry.' });
	}
	return new MagicError('unknown', message, { product });
}

/**
 * Coerce any thrown value into a MagicError. MagicErrors pass through; transport
 * failures become `network`; anything else is `unknown`.
 */
export function toMagicError(
	e: unknown,
	opts: { product?: string; networkHint?: string } = {}
): MagicError {
	if (e instanceof MagicError) return e;
	const product = opts.product ?? SHELL_PRODUCT;
	if (e instanceof Error) {
		if (isNetworkError(e)) {
			return new MagicError('network', e.message, {
				product,
				hint: opts.networkHint ?? 'Check your network connection.',
			});
		}
		return new MagicError('unknown', e.message, { product });
	}
	return new MagicError('unknown', typeof e === 'string' ? e : 'Unknown error.', { product });
}

/** Does this Error look like an undici / Node transport failure? */
export function isNetworkError(e: Error): boolean {
	const code = (e as NodeJS.ErrnoException).code ?? '';
	if (
		[
			'ECONNREFUSED',
			'ENOTFOUND',
			'ECONNRESET',
			'ETIMEDOUT',
			'EAI_AGAIN',
			'UND_ERR_CONNECT_TIMEOUT',
			'UND_ERR_SOCKET',
			'UND_ERR_HEADERS_TIMEOUT',
		].includes(code)
	) {
		return true;
	}
	if (e.name === 'AbortError' || e.name === 'TimeoutError') return true;
	// undici surfaces low-level failures as a generic TypeError: "fetch failed".
	return /fetch failed|network|socket|connect/i.test(e.message ?? '');
}
