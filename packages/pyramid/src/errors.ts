// Pyramid's errors on the kit envelope (DATATYPE-ERROR-ENVELOPE).
//
// Pyramid code still names failures in its own words (`task_not_found`,
// `reply_depth_exceeded`); `pyramidError` translates each to the family-wide code
// and keeps the Pyramid word in `details` so nothing is lost:
//   *_not_found          -> not_found        details.kind
//   ambiguous_*_name     -> ambiguous_name   details.kind
//   domain rule breaches -> validation_failed details.reason

import {
	MagicError,
	mapHttpError,
	toMagicError,
	type MagicErrorCode,
	type MagicErrorOptions,
} from '@magic-spells/kit';

export const PRODUCT = 'pyramid';

export const REGENERATE_KEY_HINT = 'Regenerate your key in Pyramid → Settings → API Keys.';
const NETWORK_HINT = 'Check MAGIC_PYRAMID_URL and your network connection.';

/** Nouns the Pyramid API reports as missing, most specific first. */
const NOT_FOUND_KINDS = ['project', 'task', 'status', 'stage', 'label', 'user', 'field'] as const;
type PyramidKind = (typeof NOT_FOUND_KINDS)[number];

type NotFoundCode = `${PyramidKind}_not_found`;
type AmbiguousCode = `ambiguous_${PyramidKind}_name`;
/** Domain rules the Pyramid API (or this package) enforces before a write. */
type RuleCode =
	'status_not_in_stage' | 'invalid_field_value' | 'reply_depth_exceeded' | 'task_archived';

export type PyramidErrorCode = MagicErrorCode | NotFoundCode | AmbiguousCode | RuleCode;

type PyramidErrorOptions = Omit<MagicErrorOptions, 'product'>;

/** Build a Pyramid MagicError from a family code or a Pyramid word for one. */
export function pyramidError(
	code: PyramidErrorCode,
	message: string,
	opts: PyramidErrorOptions = {}
): MagicError {
	const [mapped, extra] = translate(code);
	const details = extra || opts.details ? { ...opts.details, ...extra } : undefined;
	return new MagicError(mapped, message, {
		...opts,
		product: PRODUCT,
		...(details ? { details } : {}),
	});
}

function translate(code: PyramidErrorCode): [MagicErrorCode, Record<string, unknown>?] {
	const notFound = /^(\w+)_not_found$/.exec(code);
	if (notFound && code !== 'not_found') return ['not_found', { kind: notFound[1] }];
	const ambiguous = /^ambiguous_(\w+)_name$/.exec(code);
	if (ambiguous) return ['ambiguous_name', { kind: ambiguous[1] }];
	switch (code) {
		case 'status_not_in_stage':
		case 'invalid_field_value':
		case 'reply_depth_exceeded':
		case 'task_archived':
			return ['validation_failed', { reason: code }];
		default:
			return [code as MagicErrorCode];
	}
}

/** A non-2xx Pyramid response as a MagicError. */
export function mapPyramidHttpError(status: number, body: unknown): MagicError {
	return mapHttpError(status, body, {
		product: PRODUCT,
		title: 'Pyramid',
		authHint: REGENERATE_KEY_HINT,
		notFoundKinds: NOT_FOUND_KINDS,
	});
}

/** Any thrown value as a Pyramid MagicError. */
export function toPyramidError(e: unknown): MagicError {
	return toMagicError(e, { product: PRODUCT, networkHint: NETWORK_HINT });
}
