// argv -> operation input (COMPONENT-KIT "argv"), generalised from pyramid-cli's
// src/cli/index.ts. Flags and positionals are DERIVED from each operation's zod input;
// nothing here is hand-kept per command:
//   - every input field is a `--kebab-flag`; `meta.cli.positionals` are positional;
//   - booleans are presence flags; arrays take repeated flags or comma lists;
//   - a singular flag reaches a plural array field (--label -> labels), and a flag
//     naming the first segment of one key reaches it (--after -> after_task).
// Product keys never come from argv (DOC-SECURITY).

import type { z } from 'zod';

import { MagicError } from './errors.js';
import type { CliGlobalOptions } from './render.js';
import { commandWords, type Operation } from './operation.js';

// ============ Global flags ============

export interface ParsedGlobals {
	opts: CliGlobalOptions;
	/** Product-declared value flags (e.g. --project), by input key. */
	productFlags: Record<string, string>;
	/** argv with the global flags removed. */
	rest: string[];
}

/**
 * Pull the global flags out of argv wherever they appear, so `task list --json` and
 * `--json task list` both work. Unknown tokens stay in `rest` for the command parser.
 */
export function parseGlobals(
	argv: string[],
	productFlags: readonly string[] = [],
	env: NodeJS.ProcessEnv = process.env
): ParsedGlobals {
	const opts: CliGlobalOptions = {
		json: false,
		yes: false,
		quiet: false,
		...(env.NO_COLOR ? { color: false } : {}),
	};
	const flags: Record<string, string> = {};
	const rest: string[] = [];

	const valueFlag = (name: string, set: (v: string) => void, i: number): number => {
		const v = argv[i + 1];
		if (v === undefined || v.startsWith('--')) {
			throw new MagicError('usage', `flag --${name} expects a value`);
		}
		set(v);
		return i + 1;
	};

	for (let i = 0; i < argv.length; i++) {
		const tok = argv[i]!;
		switch (tok) {
			case '--json':
				opts.json = true;
				continue;
			case '--yes':
			case '-y':
				opts.yes = true;
				continue;
			case '--quiet':
			case '-q':
				opts.quiet = true;
				continue;
			case '--no-color':
				opts.color = false;
				continue;
			case '--workspace':
				i = valueFlag('workspace', (v) => (opts.workspace = v), i);
				continue;
		}
		if (tok.startsWith('--workspace=')) {
			opts.workspace = tok.slice('--workspace='.length);
			continue;
		}
		const pf = productFlags.find((f) => tok === `--${f}` || tok.startsWith(`--${f}=`));
		if (pf) {
			const key = pf.replace(/-/g, '_');
			if (tok.includes('=')) flags[key] = tok.slice(tok.indexOf('=') + 1);
			else i = valueFlag(pf, (v) => (flags[key] = v), i);
			continue;
		}
		rest.push(tok);
	}
	return { opts, productFlags: flags, rest };
}

// ============ Command tree ============

export interface Command {
	op: Operation;
	/** Words after the product, e.g. ['task', 'next'] matched against argv. */
	words: string[];
	/** Alternative last words. */
	verbAliases: string[];
	positionals: string[];
}

export function buildCommands(ops: Operation[]): Command[] {
	return ops.map((op) => ({
		op,
		words: commandWords(op),
		verbAliases: op.meta?.cli?.verbAliases ?? [],
		positionals: op.meta?.cli?.positionals ?? [],
	}));
}

/** Match argv to a command by its words (the last word may be a verb alias). */
export function matchCommand(
	cmds: Command[],
	argv: string[]
): { cmd: Command; args: string[] } | undefined {
	// Longest match first, so `task list` never shadows a three-word command.
	const sorted = [...cmds].sort((a, b) => b.words.length - a.words.length);
	for (const cmd of sorted) {
		const n = cmd.words.length;
		if (argv.length < n) continue;
		const head = argv.slice(0, n - 1);
		const last = argv[n - 1]!;
		const lastOk = last === cmd.words[n - 1] || cmd.verbAliases.includes(last);
		if (lastOk && head.every((w, i) => w === cmd.words[i])) {
			return { cmd, args: argv.slice(n) };
		}
	}
	return undefined;
}

// ============ zod introspection ============

export type FieldKind = 'string' | 'number' | 'boolean' | 'string[]' | 'enum' | 'json';

export interface FieldSpec {
	key: string;
	kind: FieldKind;
	values?: string[];
	required: boolean;
}

function baseType(schema: z.ZodTypeAny): { type: z.ZodTypeAny; optional: boolean } {
	let cur: z.ZodTypeAny = schema;
	let optional = false;
	for (let guard = 0; guard < 12; guard++) {
		const def = (cur as { _def?: { typeName?: string; innerType?: z.ZodTypeAny } })._def;
		const name = def?.typeName;
		if (
			(name === 'ZodOptional' || name === 'ZodNullable' || name === 'ZodDefault') &&
			def?.innerType
		) {
			optional = true;
			cur = def.innerType;
			continue;
		}
		break;
	}
	return { type: cur, optional };
}

/** The fields of an operation's input, for flag and positional derivation. */
export function describeFields(input: z.ZodTypeAny): FieldSpec[] {
	const shape = (input as unknown as { shape?: Record<string, z.ZodTypeAny> }).shape;
	if (!shape) return [];
	return Object.entries(shape).map(([key, raw]) => {
		const { type, optional } = baseType(raw);
		const def = (type as { _def?: { typeName?: string; values?: unknown; type?: z.ZodTypeAny } })
			._def;
		let kind: FieldKind = 'string';
		let values: string[] | undefined;
		switch (def?.typeName) {
			case 'ZodBoolean':
				kind = 'boolean';
				break;
			case 'ZodNumber':
				kind = 'number';
				break;
			case 'ZodArray': {
				// Arrays of scalars are repeatable flags; arrays of objects only come from --file.
				const el = def.type ? baseType(def.type).type : undefined;
				const elName = (el as { _def?: { typeName?: string } } | undefined)?._def?.typeName;
				kind = elName === 'ZodObject' ? 'json' : 'string[]';
				break;
			}
			case 'ZodEnum':
				kind = 'enum';
				if (Array.isArray(def.values)) values = def.values as string[];
				break;
			case 'ZodNativeEnum':
				kind = 'enum';
				break;
			case 'ZodObject':
			case 'ZodRecord':
				kind = 'json';
				break;
		}
		const spec: FieldSpec = { key, kind, required: !optional };
		if (values) spec.values = values;
		return spec;
	});
}

/** snake_case input key -> kebab-case flag. */
export function keyToFlag(key: string): string {
	return key.replace(/_/g, '-');
}

/** A flag name -> the input key it targets, or undefined. */
export function flagToKey(
	flag: string,
	fields: FieldSpec[],
	aliases: Record<string, string> = {}
): string | undefined {
	if (aliases[flag]) return aliases[flag];
	const snake = flag.replace(/-/g, '_');
	const direct = fields.find((f) => f.key === snake || keyToFlag(f.key) === flag);
	if (direct) return direct.key;
	const plural = fields.find((f) => f.kind === 'string[]' && f.key === `${snake}s`);
	if (plural) return plural.key;
	const seg = fields.filter((f) => f.key.split('_')[0] === snake);
	if (seg.length === 1) return seg[0]!.key;
	return undefined;
}

// ============ Per-command parsing ============

export type RawValues = Record<string, unknown>;

export interface ParsedArgs {
	raw: RawValues;
	/** Presence flags declared by meta.cli.presets / meta.cli.routes. */
	switches: string[];
	/** --file <path>, when meta.cli.fileInput is set. */
	file?: string;
}

/** Parse one command's argv into raw values keyed by input key. Throws usage errors. */
export function parseCommandArgs(cmd: Command, args: string[]): ParsedArgs {
	const cli = cmd.op.meta?.cli ?? {};
	const fields = describeFields(cmd.op.input);
	const byKey = new Map(fields.map((f) => [f.key, f]));
	const switchNames = new Set([
		...Object.keys(cli.presets ?? {}),
		...Object.keys(cli.routes ?? {}),
	]);
	const raw: RawValues = {};
	const parsed: ParsedArgs = { raw, switches: [] };
	const queue = [...cmd.positionals];
	const label = cmd.words.join(' ');

	const pushArray = (key: string, value: string): void => {
		const parts = value
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		raw[key] = [...(Array.isArray(raw[key]) ? (raw[key] as string[]) : []), ...parts];
	};

	for (let i = 0; i < args.length; i++) {
		const tok = args[i]!;
		if (tok.startsWith('--')) {
			let name = tok.slice(2);
			let inline: string | undefined;
			const eq = name.indexOf('=');
			if (eq >= 0) {
				inline = name.slice(eq + 1);
				name = name.slice(0, eq);
			}
			if (switchNames.has(name)) {
				parsed.switches.push(name);
				continue;
			}
			if (cli.fileInput && name === 'file') {
				const v = inline ?? args[++i];
				if (v === undefined) throw usage(`${label}: flag --file expects a path`);
				parsed.file = v;
				continue;
			}
			const key = flagToKey(name, fields, cli.aliases);
			if (!key) throw usage(`${label}: unknown flag --${name}`);
			const spec = byKey.get(key)!;
			if (spec.kind === 'boolean') {
				raw[key] = inline === undefined ? true : inline !== 'false';
				continue;
			}
			const value = inline ?? args[++i];
			if (value === undefined) throw usage(`${label}: flag --${name} expects a value`);
			if (spec.kind === 'string[]') pushArray(key, value);
			else if (spec.kind === 'json') raw[key] = parseJsonFlag(label, name, value);
			else raw[key] = value;
			continue;
		}
		const posKey = queue.shift();
		if (!posKey) throw usage(`${label}: unexpected argument "${tok}"`);
		if (byKey.get(posKey)?.kind === 'string[]') pushArray(posKey, tok);
		else raw[posKey] = tok;
	}
	return parsed;
}

function parseJsonFlag(label: string, flag: string, value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		throw usage(`${label}: flag --${flag} expects JSON`);
	}
}

/** Strings to numbers where the schema wants numbers; zod has the final word. */
export function coerce(raw: RawValues, fields: FieldSpec[]): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const f of fields) {
		const v = raw[f.key];
		if (v === undefined) continue;
		if (f.kind === 'number' && typeof v === 'string') {
			const n = Number(v);
			out[f.key] = Number.isNaN(n) ? v : n;
		} else {
			out[f.key] = v;
		}
	}
	return out;
}

export function usage(message: string, hint?: string): MagicError {
	return new MagicError('usage', message, hint ? { hint } : {});
}
