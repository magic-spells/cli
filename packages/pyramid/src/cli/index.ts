// FILE-CLI — argv -> operation -> render (DOC-CLI).
//
// The command tree is DERIVED FROM THE REGISTRY, never hand-maintained: walk
// `operations`, read `meta.cli.{group,verb,positionals,aliases}`, and build a
// per-op parser from the operation's zod input schema. Each input field becomes a
// `--flag`; fields in `positionals` become positional args. Booleans are presence
// flags; arrays accept repeated flags or comma lists. The registry is the single
// seam: src/server.ts (MCP) and this file (CLI) both render from it.
//
// Invariants (DOC-CLI, DOC-CLI-OUTPUT):
//   - PYRAMID_API_KEY is env-only — never a flag (keeps keys out of argv/history).
//   - Diagnostics → stderr; data → stdout (render.ts owns that).
//   - Op input is validated with op.input.safeParse; a parse failure is a usage
//     error → stderr, exit 2 (FLOW-CLI-INVOKE step 2).

import { readFileSync } from 'node:fs';

import { z } from 'zod';

import { loadConfig } from '../config.js';
import { isMcpError, McpError, toMcpError } from '../errors.js';
import { operations } from '../operations/index.js';
import type { Operation, OpContext } from '../operations/index.js';
import { PyramidClient } from '../client/pyramid-client.js';
import { Resolver } from '../cache/resolver.js';
import { render, renderError, renderUsageError, type CliGlobalOptions } from './render.js';

// ============ Global-flag parsing (light, hand-rolled) ============

/** Global flags consumed before the subcommand; everything else is the command. */
interface ParsedGlobals {
	opts: CliGlobalOptions;
	/** argv with the recognized global flags removed (the command + its args). */
	rest: string[];
}

/**
 * Pull the global flags (DATATYPE-CLI-OPTIONS) out of argv. A LIGHT hand-rolled
 * pass — no heavy dependency. Unknown tokens are left in `rest` for the per-op
 * parser. Globals are positional-agnostic (may appear before or after the
 * subcommand) so `pyramid task list --json` and `pyramid --json task list` both work.
 */
function parseGlobals(argv: string[]): ParsedGlobals {
	const opts: CliGlobalOptions = {
		json: false,
		yes: false,
		quiet: false,
		// NO_COLOR env disables color even without --no-color (informational only).
		color: process.env.NO_COLOR ? false : undefined,
	};
	const rest: string[] = [];

	for (let i = 0; i < argv.length; i++) {
		const tok = argv[i]!;
		switch (tok) {
			case '--json':
				opts.json = true;
				break;
			case '--yes':
			case '-y':
				opts.yes = true;
				break;
			case '--quiet':
			case '-q':
				opts.quiet = true;
				break;
			case '--no-color':
				opts.color = false;
				break;
			case '--no-cache':
				opts.noCache = true;
				break;
			case '--project':
				opts.project = argv[++i];
				break;
			case '--base-url':
				opts.baseUrl = argv[++i];
				break;
			default:
				// `--project=foo` / `--base-url=foo` inline forms.
				if (tok.startsWith('--project=')) opts.project = tok.slice('--project='.length);
				else if (tok.startsWith('--base-url=')) opts.baseUrl = tok.slice('--base-url='.length);
				else rest.push(tok);
		}
	}

	return { opts, rest };
}

// ============ Command tree (derived from the registry) ============

/** A built command node: the operation plus its CLI surface metadata. */
interface Command {
	op: Operation;
	group: string;
	verb: string;
	positionals: string[];
	aliases: Record<string, string>;
}

/** Build the command tree from the operation registry. */
function buildCommands(): Command[] {
	const cmds: Command[] = [];
	for (const op of operations) {
		const cli = op.meta?.cli;
		if (!cli) continue; // an op with no CLI surface (none in MVP) is MCP-only.
		cmds.push({
			op,
			group: cli.group,
			verb: cli.verb,
			positionals: cli.positionals ?? [],
			aliases: cli.aliases ?? {},
		});
	}
	return cmds;
}

/**
 * Match argv (post-globals) to a command. A command is identified by its
 * `group` then `verb`; a command with an empty verb (e.g. `whoami`) matches on
 * the group alone. Returns the command plus the remaining argv (its args).
 */
function matchCommand(
	cmds: Command[],
	argv: string[]
): { cmd: Command; args: string[] } | undefined {
	const [first, second, ...rest] = argv;
	if (!first) return undefined;

	// Empty-verb command (group-only, e.g. `whoami`).
	const groupOnly = cmds.find((c) => c.group === first && c.verb === '');
	if (groupOnly) return { cmd: groupOnly, args: argv.slice(1) };

	// group + verb (e.g. `task list`).
	if (second) {
		const exact = cmds.find((c) => c.group === first && c.verb === second);
		if (exact) return { cmd: exact, args: rest };
	}
	return undefined;
}

// ============ zod schema introspection ============

type FieldKind = 'string' | 'number' | 'boolean' | 'string[]' | 'enum';

interface FieldSpec {
	/** input key (snake_case). */
	key: string;
	kind: FieldKind;
	/** enum values, when kind === "enum". */
	values?: string[];
	/** array element kind, when kind === "string[]" (always string in MVP). */
	required: boolean;
}

/** Unwrap optional/default/nullable wrappers to the base zod type. */
function baseType(schema: z.ZodTypeAny): { type: z.ZodTypeAny; optional: boolean } {
	let cur: z.ZodTypeAny = schema;
	let optional = false;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	for (let guard = 0; guard < 12; guard++) {
		const def = (cur as { _def?: { typeName?: string; innerType?: z.ZodTypeAny } })._def;
		const name = def?.typeName;
		if (name === 'ZodOptional' || name === 'ZodNullable' || name === 'ZodDefault') {
			optional = true;
			if (def?.innerType) {
				cur = def.innerType;
				continue;
			}
		}
		break;
	}
	return { type: cur, optional };
}

/** Describe the fields of an operation's input zod object for flag/positional derivation. */
function describeFields(input: z.ZodTypeAny): FieldSpec[] {
	const obj = input as unknown as { shape?: Record<string, z.ZodTypeAny> };
	const shape = obj.shape;
	if (!shape) return [];

	const specs: FieldSpec[] = [];
	for (const [key, raw] of Object.entries(shape)) {
		const { type, optional } = baseType(raw);
		const def = (type as { _def?: { typeName?: string; values?: unknown } })._def;
		const name = def?.typeName;

		let kind: FieldKind = 'string';
		let values: string[] | undefined;
		if (name === 'ZodBoolean') kind = 'boolean';
		else if (name === 'ZodNumber') kind = 'number';
		else if (name === 'ZodArray') kind = 'string[]';
		else if (name === 'ZodEnum') {
			kind = 'enum';
			values = Array.isArray(def?.values) ? (def!.values as string[]) : undefined;
		} else if (name === 'ZodNativeEnum') {
			kind = 'enum';
		}

		const spec: FieldSpec = { key, kind, required: !optional };
		if (values) spec.values = values;
		specs.push(spec);
	}
	return specs;
}

// ============ Flag-name mapping ============

/** snake_case input key -> kebab-case flag name (the long flag). */
function keyToFlag(key: string): string {
	return key.replace(/_/g, '-');
}

/** kebab/alias flag -> the input key it targets, for a given field set. */
function flagToKey(
	flag: string,
	fields: FieldSpec[],
	aliases: Record<string, string>
): string | undefined {
	// Explicit per-op alias (e.g. short flag) wins.
	if (aliases[flag]) return aliases[flag];

	const kebab = flag;
	const snake = flag.replace(/-/g, '_');

	// Direct key / kebab match.
	const direct = fields.find((f) => f.key === snake || keyToFlag(f.key) === kebab);
	if (direct) return direct.key;

	// Singular alias for an array field: --label -> labels, --mention -> mentions,
	// --add-label -> add_labels, --remove-label -> remove_labels, --include -> include.
	const plural = `${snake}s`;
	const pluralField = fields.find((f) => f.kind === 'string[]' && f.key === plural);
	if (pluralField) return pluralField.key;

	// First-segment alias: a flag that names the leading segment of a snake_case
	// key resolves to it when unambiguous (--after -> after_task, --before ->
	// before_task). Spec command tree uses the short forms (DOC-CLI).
	const segMatches = fields.filter((f) => f.key.split('_')[0] === snake);
	if (segMatches.length === 1) return segMatches[0]!.key;

	return undefined;
}

// ============ Per-op argv parsing ============

/** Raw values gathered for one command before zod coercion. */
type RawValues = Record<string, string | boolean | string[] | undefined>;

/**
 * Parse a command's argv into a raw value map keyed by input key. Positionals are
 * assigned in declaration order; flags map to fields by name (with singular array
 * aliases). Arrays accumulate across repeated flags and also split comma lists.
 * Returns the raw map plus any special flags (e.g. --file, --all, --unarchive).
 */
interface ParsedArgs {
	raw: RawValues;
	special: { file?: string; all?: boolean; unarchive?: boolean };
	usageError?: string;
}

function parseCommandArgs(cmd: Command, args: string[]): ParsedArgs {
	const fields = describeFields(cmd.op.input);
	const fieldByKey = new Map(fields.map((f) => [f.key, f]));
	const raw: RawValues = {};
	const special: ParsedArgs['special'] = {};
	const positionalQueue = [...cmd.positionals];

	const pushArray = (key: string, value: string): void => {
		const parts = value
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		const existing = Array.isArray(raw[key]) ? (raw[key] as string[]) : [];
		raw[key] = [...existing, ...parts];
	};

	for (let i = 0; i < args.length; i++) {
		const tok = args[i]!;

		if (tok.startsWith('--')) {
			// Split inline `--flag=value`.
			let flagName = tok.slice(2);
			let inlineValue: string | undefined;
			const eq = flagName.indexOf('=');
			if (eq >= 0) {
				inlineValue = flagName.slice(eq + 1);
				flagName = flagName.slice(0, eq);
			}

			// Special non-field flags handled per command.
			if (flagName === 'file') {
				special.file = inlineValue ?? args[++i];
				continue;
			}
			if (flagName === 'all') {
				special.all = true;
				continue;
			}
			if (flagName === 'unarchive') {
				special.unarchive = true;
				continue;
			}
			// `--mine` re-routes task.list -> task.mine (handled by the caller).
			if (flagName === 'mine') {
				raw.__mine = true as unknown as string;
				continue;
			}

			const key = flagToKey(flagName, fields, cmd.aliases);
			if (!key) {
				return { raw, special, usageError: `unknown flag --${flagName}` };
			}
			const spec = fieldByKey.get(key)!;

			if (spec.kind === 'boolean') {
				raw[key] = inlineValue === undefined ? true : inlineValue !== 'false';
				continue;
			}

			const value = inlineValue ?? args[++i];
			if (value === undefined) {
				return { raw, special, usageError: `flag --${flagName} expects a value` };
			}
			if (spec.kind === 'string[]') pushArray(key, value);
			else raw[key] = value;
			continue;
		}

		// Short combined globals already stripped; a lone `-y`/`-q` shouldn't reach
		// here, but tolerate stray single-dash tokens as positionals.

		// Positional.
		const posKey = positionalQueue.shift();
		if (!posKey) {
			return { raw, special, usageError: `unexpected argument "${tok}"` };
		}
		const posSpec = fieldByKey.get(posKey);
		if (posSpec?.kind === 'string[]') pushArray(posKey, tok);
		else raw[posKey] = tok;
	}

	return { raw, special };
}

// ============ Coercion: raw strings -> zod-typed input ============

/**
 * Coerce the gathered raw values into the shape the op's zod schema expects.
 * Numbers parse from strings; booleans stay booleans; arrays stay string arrays;
 * everything else passes through as strings. The schema's own `.safeParse`
 * (called by the caller) is the final validation gate.
 */
function coerce(raw: RawValues, fields: FieldSpec[]): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const f of fields) {
		const v = raw[f.key];
		if (v === undefined) continue;
		if (f.kind === 'number' && typeof v === 'string') {
			const n = Number(v);
			out[f.key] = Number.isNaN(n) ? v : n; // leave invalid for zod to reject
		} else {
			out[f.key] = v;
		}
	}
	return out;
}

// ============ Destructive confirmation ============

/**
 * Gate a destructive command. Requires BOTH the env gate (config.allowDestructive)
 * AND confirmation. The env gate is enforced inside the op (throws
 * destructive_action_disabled). Here we enforce the CONFIRM half: in a non-TTY the
 * caller must pass --yes; an interactive prompt is not available in this entrypoint
 * (stdin is the MCP channel), so non-interactive without --yes is a usage error.
 */
function ensureDestructiveConfirm(opts: CliGlobalOptions): void {
	if (opts.yes) return;
	if (process.stdout.isTTY === true && process.stdin.isTTY === true) {
		// Interactive confirm would prompt on stderr; the harness has no readline
		// loop wired here, so require explicit --yes everywhere for determinism.
		renderUsageError('this action is destructive — re-run with --yes to confirm.');
	}
	renderUsageError(
		'this action is destructive and stdin is not interactive — pass --yes to confirm.'
	);
}

// ============ Bulk-create --file ============

/**
 * Load `--file tasks.json` into the `tasks` array for task.bulk-create. The file
 * is a JSON array of task rows (or `{ tasks: [...] }`). Throws a usage error on a
 * missing/invalid file.
 */
function loadBulkFile(path: string): unknown[] {
	let text: string;
	try {
		text = readFileSync(path, 'utf8');
	} catch (err) {
		renderUsageError(`cannot read --file ${path}: ${(err as Error).message}`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (err) {
		renderUsageError(`--file ${path} is not valid JSON: ${(err as Error).message}`);
	}
	if (Array.isArray(parsed)) return parsed;
	if (
		parsed &&
		typeof parsed === 'object' &&
		Array.isArray((parsed as { tasks?: unknown }).tasks)
	) {
		return (parsed as { tasks: unknown[] }).tasks;
	}
	renderUsageError(`--file ${path} must be a JSON array of tasks (or { "tasks": [...] }).`);
}

// ============ Help ============

/** Group the commands by `group` and print a usage tree to stderr. */
function printHelp(cmds: Command[]): void {
	const lines: string[] = [
		'pyramid — MCP server + CLI for the Pyramid project-management API',
		'',
		'Usage: pyramid <command> [args] [--flags]',
		'       pyramid mcp        start the MCP server (handled by bin)',
		'       pyramid doctor     run the auth/setup check (handled by bin)',
		'',
		'Commands:',
	];
	const byGroup = new Map<string, Command[]>();
	for (const c of cmds) {
		const arr = byGroup.get(c.group) ?? [];
		arr.push(c);
		byGroup.set(c.group, arr);
	}
	for (const [group, list] of byGroup) {
		for (const c of list) {
			const name = c.verb ? `${group} ${c.verb}` : group;
			const pos = c.positionals.map((p) => `<${p}>`).join(' ');
			lines.push(`  ${`${name} ${pos}`.trim().padEnd(34)}${c.op.summary}`);
		}
	}
	lines.push('');
	lines.push(
		'Global flags: --json --project <P> --base-url <U> --yes/-y --no-color --quiet/-q --no-cache'
	);
	process.stderr.write(`${lines.join('\n')}\n`);
}

// ============ Context construction ============

/** Build the OpContext from env + flag overrides (flags win — DATATYPE-CLI-OPTIONS). */
function buildContext(opts: CliGlobalOptions): OpContext {
	// loadConfig throws a plain Error on bad env; the caller converts to exit 1/usage.
	const overrides = opts.baseUrl ? { baseUrl: opts.baseUrl } : undefined;
	const config = overrides
		? loadConfig({ ...process.env, PYRAMID_BASE_URL: overrides.baseUrl })
		: loadConfig(process.env);
	const client = new PyramidClient(config);
	const resolver = new Resolver(client as never);
	return { client, resolver: resolver as never, config };
}

// ============ Entry ============

/**
 * Run the CLI: parse globals, match a command from the registry, derive + parse
 * the op's args, load config, construct the context, run the op, and render the
 * result (or McpError) with the proper exit code.
 *
 * @returns a process exit code (0 on success). On an McpError, `renderError`
 *   calls `process.exit` directly; the returned value is for the success path and
 *   for usage errors that don't terminate before returning.
 */
export async function runCli(argv: string[]): Promise<number> {
	const cmds = buildCommands();
	const { opts, rest } = parseGlobals(argv);

	// No command / explicit help → print the usage tree to stderr, exit 0.
	if (rest.length === 0 || rest[0] === 'help' || rest[0] === '--help' || rest[0] === '-h') {
		printHelp(cmds);
		return 0;
	}

	const matched = matchCommand(cmds, rest);
	if (!matched) {
		renderUsageError(`unknown command: ${rest.join(' ')}`, 'Run `pyramid help` for usage.');
	}
	let { cmd } = matched;
	const { args } = matched;

	// Parse the command's argv into raw values + special flags.
	const parsed = parseCommandArgs(cmd, args);
	if (parsed.usageError) {
		renderUsageError(`${cmd.group} ${cmd.verb}: ${parsed.usageError}`.trim());
	}

	// `task list --mine` re-routes to list_my_tasks (DOC-CLI).
	if (cmd.op.name === 'list_tasks' && parsed.raw.__mine) {
		const mine = cmds.find((c) => c.op.name === 'list_my_tasks');
		if (mine) {
			cmd = mine;
			// Re-parse against task.mine's fields so unsupported list-only flags error.
			const reparsed = parseCommandArgs(
				mine,
				args.filter((a) => a !== '--mine')
			);
			if (reparsed.usageError) {
				renderUsageError(`${mine.group} ${mine.verb}: ${reparsed.usageError}`.trim());
			}
			parsed.raw = reparsed.raw;
			Object.assign(parsed.special, reparsed.special);
		}
	}
	delete parsed.raw.__mine;

	// `task archive --unarchive` → archived: false (DOC-CLI).
	if (cmd.op.name === 'archive_task') {
		parsed.raw.archived = parsed.special.unarchive ? false : true;
	}

	// `--file` for bulk-create loads the tasks array.
	if (cmd.op.name === 'create_tasks_bulk' && parsed.special.file) {
		(parsed.raw as Record<string, unknown>).tasks = loadBulkFile(parsed.special.file);
	}

	// Apply the global --project default to commands that take a `project` field.
	const fields = describeFields(cmd.op.input);
	if (opts.project && fields.some((f) => f.key === 'project') && parsed.raw.project === undefined) {
		parsed.raw.project = opts.project;
	}

	// Surface --no-cache to the op when its input carries a noCache field.
	if (opts.noCache && fields.some((f) => f.key === 'noCache')) {
		(parsed.raw as Record<string, unknown>).noCache = true;
	}

	// Coerce raw strings to the schema's expected types, then VALIDATE with zod.
	// A non-array field carrying the tasks array (bulk-create) passes through.
	const coerced = coerce(parsed.raw, fields);
	if ((parsed.raw as Record<string, unknown>).tasks !== undefined) {
		coerced.tasks = (parsed.raw as Record<string, unknown>).tasks;
	}

	const result = cmd.op.input.safeParse(coerced);
	if (!result.success) {
		const first = result.error.issues[0];
		const where = first?.path.length ? ` (${first.path.join('.')})` : '';
		renderUsageError(
			`${cmd.group} ${cmd.verb}: invalid arguments${where}: ${first?.message ?? 'validation failed'}`.trim()
		);
	}

	// Destructive confirm gate (env gate is enforced inside the op).
	if (cmd.op.meta?.destructive) {
		ensureDestructiveConfirm(opts);
	}

	// Build context (env + flag overrides). A bad env is a plain Error from
	// loadConfig — surface its message to stderr and exit 1 (no stack).
	let ctx: OpContext;
	try {
		ctx = buildContext(opts);
	} catch (err) {
		process.stderr.write(`${(err as Error).message}\n`);
		return 1;
	}

	// Run the operation; render the result or the McpError with its exit code.
	try {
		const out = await cmd.op.run(result.data, ctx);
		render(out, opts);
		return 0;
	} catch (err) {
		const mapped: McpError = isMcpError(err) ? err : toMcpError(err);
		renderError(mapped, opts); // never returns
	}
}
