// Pyramid's error adapter: Pyramid words for failures map onto the kit envelope
// (DATATYPE-ERROR-ENVELOPE) with the Pyramid word kept in details.

import { describe, expect, it } from 'vitest';

import { exitCodeFor } from '@magic-spells/kit';

import { mapPyramidHttpError, pyramidError, toPyramidError } from '../src/errors.js';

describe('pyramidError — Pyramid words onto family codes', () => {
	it('*_not_found becomes not_found with details.kind', () => {
		const err = pyramidError('task_not_found', 'No task matches "WEB-9".');
		expect(err.code).toBe('not_found');
		expect(err.details).toEqual({ kind: 'task' });
		expect(err.product).toBe('pyramid');
		expect(exitCodeFor(err.code)).toBe(5);
	});

	it('ambiguous_*_name becomes ambiguous_name with details.kind and keeps candidates', () => {
		const err = pyramidError('ambiguous_user_name', 'pick one', { candidates: ['ann', 'andy'] });
		expect(err.code).toBe('ambiguous_name');
		expect(err.details).toEqual({ kind: 'user' });
		expect(err.candidates).toEqual(['ann', 'andy']);
		expect(exitCodeFor(err.code)).toBe(6);
	});

	it('domain rules become validation_failed with details.reason (exit 7)', () => {
		for (const reason of [
			'status_not_in_stage',
			'invalid_field_value',
			'reply_depth_exceeded',
			'task_archived',
		] as const) {
			const err = pyramidError(reason, 'nope');
			expect(err.code).toBe('validation_failed');
			expect(err.details).toEqual({ reason });
			expect(exitCodeFor(err.code)).toBe(7);
		}
	});

	it('family codes pass through unchanged', () => {
		const err = pyramidError('destructive_action_disabled', 'off', { hint: 'set it' });
		expect(err.code).toBe('destructive_action_disabled');
		expect(err.details).toBeUndefined();
		expect(err.hint).toBe('set it');
	});
});

describe('mapPyramidHttpError / toPyramidError', () => {
	it('a 401 carries the regenerate-key hint and the product', () => {
		const err = mapPyramidHttpError(401, { error: { code: 'unauthorized', message: 'no' } });
		expect(err.code).toBe('auth_invalid');
		expect(err.hint).toMatch(/API Keys/);
		expect(err.product).toBe('pyramid');
	});

	it('a 404 names the Pyramid noun', () => {
		const err = mapPyramidHttpError(404, { error: { code: 'project_not_found', message: 'x' } });
		expect(err.details).toEqual({ kind: 'project' });
	});

	it('the generic fallback message names Pyramid', () => {
		expect(mapPyramidHttpError(500, null).message).toMatch(/Pyramid request failed \(HTTP 500\)/);
	});

	it('network failures point at MAGIC_PYRAMID_URL', () => {
		const err = toPyramidError(Object.assign(new Error('connect'), { code: 'ECONNREFUSED' }));
		expect(err.code).toBe('network');
		expect(err.hint).toMatch(/MAGIC_PYRAMID_URL/);
	});
});

describe('exit classes of Pyramid failure words (pyramid-cli exit table)', () => {
	it('maps each Pyramid failure word to its documented exit class', () => {
		const exit = (c: Parameters<typeof pyramidError>[0]): number =>
			exitCodeFor(pyramidError(c, 'x').code);
		expect(exit('auth_invalid')).toBe(3);
		expect(exit('auth_expired')).toBe(3);
		expect(exit('permission_denied')).toBe(4);
		for (const c of [
			'project_not_found',
			'task_not_found',
			'status_not_found',
			'stage_not_found',
			'user_not_found',
			'label_not_found',
			'field_not_found',
		] as const) {
			expect(exit(c)).toBe(5);
		}
		expect(exit('ambiguous_project_name')).toBe(6);
		expect(exit('ambiguous_user_name')).toBe(6);
		expect(exit('ambiguous_label_name')).toBe(6);
		expect(exit('validation_failed')).toBe(7);
		expect(exit('invalid_field_value')).toBe(7);
		expect(exit('status_not_in_stage')).toBe(7);
		expect(exit('reply_depth_exceeded')).toBe(7);
		expect(exit('task_archived')).toBe(7);
		expect(exit('destructive_action_disabled')).toBe(8);
		expect(exit('rate_limited')).toBe(9);
		expect(exit('network')).toBe(10);
		expect(exit('unknown')).toBe(1);
	});
});
