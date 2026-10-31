// Unit tests for the kit's error envelope (src/errors.ts) — pure, no network.
// Moved from pyramid-cli's tests/errors.test.ts; codes follow DATATYPE-ERROR-ENVELOPE.
//
// mapHttpError turns an HTTP status + `{ error: { code, message } }` into a MagicError:
//   401 -> auth_invalid  (auth_expired when the envelope says "expired")
//   403 -> permission_denied
//   404 -> not_found (details.kind when the envelope names a declared kind)
//   400|422 -> validation_failed
//   409 -> conflict, 429 -> rate_limited, anything else -> unknown
// toMagicError: MagicError passes through; transport failures become `network`.

import { describe, it, expect } from 'vitest';
import {
	MAGIC_ERROR_CODES,
	MagicError,
	exitCodeFor,
	isMagicError,
	mapHttpError as kitMapHttpError,
	toMagicError as kitToMagicError,
	toToolError,
} from '../src/errors.js';

const KINDS = ['project', 'task', 'status', 'stage', 'label', 'user', 'field'];
const mapHttpError = (status: number, body: unknown): MagicError =>
	kitMapHttpError(status, body, {
		product: 'demo',
		title: 'Demo',
		authHint: 'Regenerate your key in Demo → Settings → API Keys.',
		notFoundKinds: KINDS,
	});
const toMcpError = (e: unknown): MagicError =>
	kitToMagicError(e, { product: 'demo', networkHint: 'Check MAGIC_DEMO_URL and your network.' });
const McpError = MagicError;
const isMcpError = isMagicError;

/** Build the canonical Pyramid error envelope. */
function envelope(code: string, message = 'boom'): unknown {
	return { error: { code, message } };
}

describe('mapHttpError — status -> code', () => {
	it('maps 401 to auth_invalid with a regenerate-key hint', () => {
		const err = mapHttpError(401, envelope('unauthorized'));
		expect(err).toBeInstanceOf(McpError);
		expect(err.code).toBe('auth_invalid');
		expect(err.hint).toMatch(/API Keys/i);
	});

	it('maps 401 to auth_expired when the envelope mentions "expired"', () => {
		const err = mapHttpError(401, envelope('token_expired', 'your token has expired'));
		expect(err.code).toBe('auth_expired');
	});

	it('maps 403 to permission_denied', () => {
		const err = mapHttpError(403, envelope('forbidden'));
		expect(err.code).toBe('permission_denied');
	});

	it('maps 404 with a project envelope to not_found (kind project)', () => {
		const err = mapHttpError(404, envelope('project_not_found', 'no such project'));
		expect(err.code).toBe('not_found');
		expect(err.details).toEqual({ kind: 'project' });
	});

	it('maps 404 with a task envelope to not_found (kind task)', () => {
		const err = mapHttpError(404, envelope('task_not_found', 'no such task'));
		expect(err.code).toBe('not_found');
		expect(err.details).toEqual({ kind: 'task' });
	});

	it('maps 404 envelopes to not_found with the matching kind (status/stage/label/user/field)', () => {
		// Best-effort 404 disambiguation from the envelope code/message substring.
		for (const kind of ['status', 'stage', 'label', 'user', 'field']) {
			const err = mapHttpError(404, envelope(`${kind}_not_found`));
			expect(err.code).toBe('not_found');
			expect(err.details).toEqual({ kind });
		}
	});

	it('disambiguates a 404 from the envelope MESSAGE when the code is opaque', () => {
		const err = mapHttpError(404, envelope('not_found', 'that project is gone'));
		expect(err.details).toEqual({ kind: 'project' });
	});

	it('maps an unrecognizable 404 to not_found with no kind', () => {
		const err = mapHttpError(404, envelope('mystery', 'gone'));
		expect(err.code).toBe('not_found');
		expect(err.details).toBeUndefined();
	});

	it('maps 400 to validation_failed', () => {
		const err = mapHttpError(400, envelope('bad_request'));
		expect(err.code).toBe('validation_failed');
	});

	it('maps 422 to validation_failed', () => {
		const err = mapHttpError(422, envelope('unprocessable'));
		expect(err.code).toBe('validation_failed');
		expect(err.hint).toBeUndefined();
	});

	// A PATCH can carry both owner_id and reviewer_id, and a non-member in either
	// half yields the SAME message — only details.field says which one.
	it('names details.field in the hint on a 422 (non-member owner/reviewer)', () => {
		const err = mapHttpError(422, {
			error: {
				code: 'validation_failed',
				message: 'user is not a member of this project',
				details: { field: 'owner_id', user_id: 'u-stranger' },
			},
		});
		expect(err.code).toBe('validation_failed');
		expect(err.hint).toContain('owner_id');
		expect(err.details).toEqual({ field: 'owner_id' });
	});

	it('ignores a details blob with no usable field', () => {
		const err = mapHttpError(422, {
			error: { code: 'validation_failed', message: 'boom', details: { field: 42 } },
		});
		expect(err.hint).toBeUndefined();
	});

	it('maps 429 to rate_limited', () => {
		const err = mapHttpError(429, envelope('rate_limited'));
		expect(err.code).toBe('rate_limited');
	});

	it('maps 500 to unknown', () => {
		const err = mapHttpError(500, envelope('internal'));
		expect(err.code).toBe('unknown');
	});

	it('maps an unlisted status (e.g. 418) to unknown', () => {
		const err = mapHttpError(418, envelope('teapot'));
		expect(err.code).toBe('unknown');
	});

	it('prefers the envelope message when present', () => {
		const err = mapHttpError(403, envelope('forbidden', 'you cannot do that'));
		expect(err.message).toBe('you cannot do that');
	});

	it('falls back to a generic message when the body has no envelope', () => {
		const err = mapHttpError(500, { something: 'else' });
		expect(err.code).toBe('unknown');
		expect(err.message).toMatch(/500/);
	});

	it('tolerates a non-object body (null / string)', () => {
		expect(mapHttpError(500, null).code).toBe('unknown');
		expect(mapHttpError(401, 'not json').code).toBe('auth_invalid');
	});
});

describe('toMagicError — coerce arbitrary throws', () => {
	it('passes a MagicError through unchanged', () => {
		const original = new McpError('rate_limited', 'slow down', { hint: 'wait' });
		expect(toMcpError(original)).toBe(original);
	});

	it('classifies an ECONNREFUSED error as network', () => {
		const e = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
		const err = toMcpError(e);
		expect(err.code).toBe('network');
		// Network failures carry an actionable base-URL/connection hint.
		expect(err.hint).toMatch(/MAGIC_DEMO_URL/);
	});

	it('classifies every transport-level errno (DNS / reset / timeout / undici) as network', () => {
		for (const code of [
			'ENOTFOUND',
			'ECONNRESET',
			'ETIMEDOUT',
			'EAI_AGAIN',
			'UND_ERR_CONNECT_TIMEOUT',
			'UND_ERR_SOCKET',
			'UND_ERR_HEADERS_TIMEOUT',
		]) {
			const e = Object.assign(new Error(`transport failure: ${code}`), { code });
			expect(toMcpError(e).code).toBe('network');
		}
	});

	it('classifies abort/timeout errors (by name) as network', () => {
		const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
		const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
		expect(toMcpError(abort).code).toBe('network');
		expect(toMcpError(timeout).code).toBe('network');
	});

	it('classifies a generic undici "fetch failed" as network', () => {
		const err = toMcpError(new TypeError('fetch failed'));
		expect(err.code).toBe('network');
	});

	it('classifies an arbitrary Error as unknown', () => {
		const err = toMcpError(new Error('something odd'));
		expect(err.code).toBe('unknown');
		expect(err.message).toBe('something odd');
	});

	it('coerces a thrown string to unknown', () => {
		const err = toMcpError('plain string failure');
		expect(err.code).toBe('unknown');
		expect(err.message).toBe('plain string failure');
	});
});

describe('MagicError — shape', () => {
	it('is an instanceof Error and MagicError, carries code/hint/candidates', () => {
		const err = new McpError('ambiguous_name', 'pick one', {
			product: 'demo',
			hint: 'be specific',
			candidates: ['alpha', 'beta'],
			details: { kind: 'project' },
		});
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(McpError);
		expect(err.code).toBe('ambiguous_name');
		expect(err.product).toBe('demo');
		expect(err.hint).toBe('be specific');
		expect(err.candidates).toEqual(['alpha', 'beta']);
	});

	it('sets name to "MagicError", defaults product to magic, exposes the message', () => {
		const err = new McpError('validation_failed', 'bad input');
		expect(err.name).toBe('MagicError');
		expect(err.product).toBe('magic');
		expect(err.message).toBe('bad input');
	});

	it('toJSON() emits { code, message, product } and omits absent hint/candidates', () => {
		const json = new McpError('validation_failed', 'bad input').toJSON();
		expect(json).toEqual({ code: 'validation_failed', message: 'bad input', product: 'magic' });
		expect('hint' in json).toBe(false);
		expect('candidates' in json).toBe(false);
	});

	it('toJSON() includes hint/candidates when present', () => {
		const json = new McpError('ambiguous_name', 'pick one', {
			product: 'demo',
			hint: 'narrow it',
			candidates: ['ann', 'andy'],
			details: { kind: 'user' },
		}).toJSON();
		expect(json).toEqual({
			code: 'ambiguous_name',
			message: 'pick one',
			product: 'demo',
			hint: 'narrow it',
			candidates: ['ann', 'andy'],
			details: { kind: 'user' },
		});
	});
});

describe('isMagicError — discriminator', () => {
	it('is true for a MagicError', () => {
		expect(isMcpError(new McpError('unknown', 'x'))).toBe(true);
	});

	it('is false for a plain Error and non-error values', () => {
		expect(isMcpError(new Error('plain'))).toBe(false);
		expect(isMcpError('string')).toBe(false);
		expect(isMcpError(null)).toBe(false);
		expect(isMcpError({ code: 'unknown', message: 'lookalike' })).toBe(false);
	});
});

describe('toToolError — MCP tool-result envelope', () => {
	it('wraps the serialized error in a single text block with isError:true', () => {
		const err = new McpError('rate_limited', 'slow down', { hint: 'wait' });
		const result = toToolError(err);
		expect(result.isError).toBe(true);
		expect(result.content).toHaveLength(1);
		expect(result.content[0]?.type).toBe('text');
		// The text payload must be the parseable JSON of the error's toJSON() shape.
		expect(JSON.parse(result.content[0]!.text)).toEqual({
			error: { code: 'rate_limited', message: 'slow down', hint: 'wait', product: 'magic' },
		});
	});
});

describe('exitCodeFor — the exit table (DECISION-OPERATION-CONTRACT)', () => {
	const TABLE: Record<string, number> = {
		usage: 2,
		not_logged_in: 3,
		auth_invalid: 3,
		auth_expired: 3,
		permission_denied: 4,
		not_found: 5,
		ambiguous_name: 6,
		validation_failed: 7,
		conflict: 7,
		diagnostics: 7,
		destructive_action_disabled: 8,
		rate_limited: 9,
		network: 10,
		product_unavailable: 11,
		unknown: 1,
	};

	it('covers every code exactly, with its documented class', () => {
		expect([...MAGIC_ERROR_CODES].sort()).toEqual(Object.keys(TABLE).sort());
		for (const code of MAGIC_ERROR_CODES) expect(exitCodeFor(code)).toBe(TABLE[code]);
	});
});
