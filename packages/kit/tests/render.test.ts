// The output contract (COMPONENT-RENDER), moved from pyramid-cli's tests/cli.test.ts:
//   - stdout carries DATA only (human lines or JSON);
//   - stderr carries DIAGNOSTICS (errors, hints, pagination notes);
//   - output is JSON when --json OR stdout is not a TTY;
//   - an error renders to stderr and maps to its exit class.
// The runCli half of that file is covered by tests/cli.test.ts against a demo product.

import { describe, expect, it } from 'vitest';

import { MagicError } from '../src/errors.js';
import { render, renderError, type CliGlobalOptions } from '../src/render.js';
import { captureIO } from './helpers.js';

const BASE_OPTS: CliGlobalOptions = { json: false, yes: false, quiet: false };

// ============ render — format + stream contract ============

describe('render — emits JSON when --json or non-TTY (DOC-CLI-OUTPUT)', () => {
	let cap: ReturnType<typeof captureIO>;

	it('writes pretty JSON to stdout when --json is set (even on a TTY)', () => {
		cap = captureIO(true);
		const result = { key: 'APO-1', title: 'Wire auth' };
		render(result, { ...BASE_OPTS, json: true }, cap);

		expect(cap.stderr).toBe(''); // no diagnostics on the data path
		expect(JSON.parse(cap.stdout)).toEqual(result);
	});

	it('auto-JSONs to stdout when stdout is NOT a TTY (pipe/agent), no --json needed', () => {
		cap = captureIO(false);
		const result = { key: 'APO-1', status: { id: 'st-1', name: 'In Review' } };
		render(result, { ...BASE_OPTS, json: false }, cap);

		// non-TTY -> machine consumers always get parseable JSON.
		expect(JSON.parse(cap.stdout)).toEqual(result);
	});

	it('prints a compact human line (not JSON) on a TTY without --json', () => {
		cap = captureIO(true);
		render({ key: 'APO-1', title: 'Wire auth' }, { ...BASE_OPTS, json: false }, cap);

		// human mode: aligned key/value lines, NOT a JSON object.
		expect(cap.stdout).toContain('key');
		expect(cap.stdout).toContain('APO-1');
		expect(() => JSON.parse(cap.stdout)).toThrow();
	});

	it('renders a Page as a table and notes more results on stderr (never truncates)', () => {
		cap = captureIO(true);
		render(
			{
				items: [
					{ key: 'APO-1', title: 'a' },
					{ key: 'APO-2', title: 'b' },
				],
				next_cursor: 'CUR-2',
				has_more: true,
			},
			{ ...BASE_OPTS, json: false },
			cap
		);

		// rows on stdout (data), pagination note on stderr (diagnostic).
		expect(cap.stdout).toContain('APO-1');
		expect(cap.stdout).toContain('APO-2');
		expect(cap.stderr).toContain('more: --cursor CUR-2');
	});

	it('shows Owner and Reviewer with their job_title when one is known', () => {
		cap = captureIO(true);
		render(
			{
				key: 'APO-1',
				owner: { id: 'u-ann', display_name: 'Ann Smith', job_title: 'Design Lead' },
				reviewer: { id: 'u-bob', display_name: 'Bob Jones' },
			},
			{ ...BASE_OPTS, json: false },
			cap
		);

		// the title is what says whether the right person holds it.
		expect(cap.stdout).toContain('Ann Smith (Design Lead)');
		// no title known -> the bare name, never an empty "()".
		expect(cap.stdout).toContain('Bob Jones');
		expect(cap.stdout).not.toContain('Bob Jones (');
	});

	it('JSON mode preserves a Page envelope including the cursor on stdout', () => {
		cap = captureIO(true);
		const page = { items: [{ key: 'APO-1' }], next_cursor: 'CUR-2', has_more: true };
		render(page, { ...BASE_OPTS, json: true }, cap);

		expect(cap.stderr).toBe('');
		expect(JSON.parse(cap.stdout)).toEqual(page);
	});
});

// ============ renderError — error -> stderr + exit code ============

describe('renderError — to stderr with the mapped exit code', () => {
	it('an ambiguous_name prints `error [code]` and candidates to stderr, exit 6', () => {
		const cap = captureIO(true);
		const err = new MagicError('ambiguous_name', 'pick one', {
			candidates: ['website-redesign', 'webhooks'],
		});
		const code = renderError(err, { ...BASE_OPTS, json: false }, cap);

		expect(code).toBe(6);
		expect(cap.stdout).toBe(''); // errors NEVER pollute the data channel
		expect(cap.stderr).toContain('error [ambiguous_name]: pick one');
		expect(cap.stderr).toContain('website-redesign');
		expect(cap.stderr).toContain('webhooks');
	});

	it('emits the canonical { error: {...} } envelope to stderr under --json', () => {
		const cap = captureIO(false);
		const err = new MagicError('not_found', 'no such task', {
			product: 'demo',
			hint: 'check the key',
			details: { kind: 'task' },
		});
		const code = renderError(err, { ...BASE_OPTS, json: true }, cap);

		expect(code).toBe(5);
		expect(cap.stdout).toBe('');
		expect(JSON.parse(cap.stderr)).toEqual({
			error: {
				code: 'not_found',
				message: 'no such task',
				hint: 'check the key',
				product: 'demo',
				details: { kind: 'task' },
			},
		});
	});

	it('a destructive_action_disabled error exits 8', () => {
		const cap = captureIO(false);
		expect(
			renderError(new MagicError('destructive_action_disabled', 'gate is off'), BASE_OPTS, cap)
		).toBe(8);
	});
});
