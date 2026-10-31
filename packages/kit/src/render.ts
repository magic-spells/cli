// Output and streams (COMPONENT-RENDER), from pyramid-cli's src/cli/render.ts.
// Owns format and streams only, never business logic:
//   - stdout is the data channel; stderr carries diagnostics, hints and errors.
//   - JSON when --json or stdout is not a TTY; --json always wins.
//   - A TTY gets a compact table (arrays) or `key  value` lines (objects).
//   - Lists print next_cursor as a stderr hint and never auto-paginate.

import { exitCodeFor, type MagicError } from './errors.js';

/** Global flags that shape output and confirmation (COMPONENT-SHELL). */
export interface CliGlobalOptions {
	/** --json: force JSON (else JSON whenever stdout is not a TTY). */
	json: boolean;
	/** --yes / -y: confirm destructive actions. */
	yes: boolean;
	/** --quiet / -q: no stderr diagnostics except errors. */
	quiet: boolean;
	/** --no-color / NO_COLOR. */
	color?: boolean;
	/** --workspace <handle>. */
	workspace?: string;
}

/** Where output goes. Defaults to the process streams. */
export interface RenderIO {
	out(text: string): void;
	err(text: string): void;
	isTTY(): boolean;
}

export const processIO: RenderIO = {
	out: (text) => void process.stdout.write(text),
	err: (text) => void process.stderr.write(text),
	isTTY: () => process.stdout.isTTY === true,
};

function line(write: (t: string) => void, text: string): void {
	write(text.endsWith('\n') ? text : `${text}\n`);
}

export function jsonMode(opts: CliGlobalOptions, io: RenderIO = processIO): boolean {
	return opts.json || !io.isTTY();
}

/** Render a successful result. */
export function render(result: unknown, opts: CliGlobalOptions, io: RenderIO = processIO): void {
	if (jsonMode(opts, io)) {
		line(io.out, JSON.stringify(result, null, 2));
		return;
	}
	renderHuman(result, opts, io);
}

function isPage(v: unknown): v is { items: unknown[]; next_cursor: string | null } {
	return (
		typeof v === 'object' &&
		v !== null &&
		Array.isArray((v as { items?: unknown }).items) &&
		'next_cursor' in v
	);
}

function renderHuman(result: unknown, opts: CliGlobalOptions, io: RenderIO): void {
	const out = (t: string): void => line(io.out, t);
	if (result === null || result === undefined) {
		out('(none)');
		return;
	}
	if (isPage(result)) {
		renderRows(result.items, out);
		if (result.next_cursor && !opts.quiet) line(io.err, `more: --cursor ${result.next_cursor}`);
		return;
	}
	if (Array.isArray(result)) {
		renderRows(result, out);
		return;
	}
	if (typeof result !== 'object') {
		out(String(result));
		return;
	}
	const rec = result as Record<string, unknown>;
	const keys = Object.keys(rec);
	if (keys.length === 0) {
		out('(empty)');
		return;
	}
	const width = Math.max(...keys.map((k) => k.length));
	for (const k of keys) out(`${k.padEnd(width)}  ${cell(rec[k])}`);
}

function renderRows(rows: unknown[], out: (t: string) => void): void {
	if (rows.length === 0) {
		out('(no results)');
		return;
	}
	if (rows.every((r) => typeof r !== 'object' || r === null)) {
		for (const r of rows) out(cell(r));
		return;
	}
	const objs = rows.map((r) => (r && typeof r === 'object' ? (r as Record<string, unknown>) : {}));
	const cols: string[] = [];
	for (const o of objs) for (const k of Object.keys(o)) if (!cols.includes(k)) cols.push(k);
	const matrix = objs.map((o) => cols.map((c) => cell(o[c])));
	const widths = cols.map((c, i) => Math.max(c.length, ...matrix.map((row) => row[i]!.length)));
	out(cols.map((c, i) => c.padEnd(widths[i]!)).join('  '));
	for (const row of matrix) out(row.map((v, i) => v.padEnd(widths[i]!)).join('  '));
}

/**
 * One value as one table cell. Hydrated refs ({id,name} / {id,display_name}) collapse
 * to their label; a person shows as "Ann Smith (Design Lead)" when a job_title is
 * known; arrays join with commas; other objects fall back to compact JSON.
 */
export function cell(v: unknown): string {
	if (v === null || v === undefined) return '';
	if (typeof v === 'string') return v;
	if (typeof v === 'number' || typeof v === 'boolean') return String(v);
	if (Array.isArray(v)) return v.map(cell).join(', ');
	if (typeof v === 'object') {
		const o = v as Record<string, unknown>;
		if (typeof o.name === 'string') return o.name;
		if (typeof o.display_name === 'string') {
			return typeof o.job_title === 'string' && o.job_title.length > 0
				? `${o.display_name} (${o.job_title})`
				: o.display_name;
		}
		if (typeof o.key === 'string') return o.key;
		if (typeof o.id === 'string') return o.id;
		return JSON.stringify(v);
	}
	return String(v);
}

/**
 * Render an error to stderr and return its exit code. JSON mode prints the envelope
 * `{ error: {...} }`; human mode prints `error [code]: message`, then the hint and any
 * candidates.
 */
export function renderError(
	e: MagicError,
	opts: CliGlobalOptions,
	io: RenderIO = processIO
): number {
	const shape = e.toJSON();
	if (jsonMode(opts, io)) {
		line(io.err, JSON.stringify({ error: shape }, null, 2));
	} else {
		line(io.err, `error [${shape.code}]: ${shape.message}`);
		if (shape.hint) line(io.err, `  hint: ${shape.hint}`);
		if (shape.candidates && shape.candidates.length > 0) {
			line(io.err, `  candidates: ${shape.candidates.join(', ')}`);
		}
	}
	return exitCodeFor(e.code);
}
