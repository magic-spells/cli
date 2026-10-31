// `magic <product> …` for any ProductModule (COMPONENT-SHELL product dispatch,
// FLOW-RUN-OPERATION): parse globals, match an operation from the registry, derive
// and validate its input, apply the destructive gate, build the context, run,
// render. Returns the exit code; never calls process.exit.

import { readFileSync } from 'node:fs';

import {
	buildCommands,
	coerce,
	describeFields,
	matchCommand,
	parseCommandArgs,
	parseGlobals,
	usage,
	type Command,
} from './argv.js';
import { buildContext, productConfig, type ContextDeps } from './context.js';
import { MagicError, toMagicError } from './errors.js';
import { assertRegistry, onSurface, type Operation, type ProductModule } from './operation.js';
import { processIO, render, renderError, type CliGlobalOptions, type RenderIO } from './render.js';

export interface RunProductDeps extends ContextDeps {
	io?: RenderIO;
}

export async function runProductCli(
	product: ProductModule,
	argv: string[],
	deps: RunProductDeps
): Promise<number> {
	const io = deps.io ?? processIO;
	let opts: CliGlobalOptions = { json: false, yes: false, quiet: false };
	try {
		const parsed = parseGlobals(argv, product.globalFlags, deps.env ?? process.env);
		opts = parsed.opts;
		const { rest, productFlags } = parsed;

		const extra = rest[0] ? product.commands?.[rest[0]] : undefined;
		if (extra) {
			if (opts.workspace) throw usage(`--workspace is not supported by ${rest[0]}`);
			return await extra.run(rest.slice(1));
		}

		const ops = await product.load();
		assertRegistry(product.id, ops);
		const cmds = buildCommands(ops.filter((op) => onSurface(op, 'cli')));

		if (rest.length === 0 || ['help', '--help', '-h'].includes(rest[0]!)) {
			io.err(helpText(product, cmds));
			return 0;
		}

		const matched = matchCommand(cmds, rest);
		if (!matched) {
			throw usage(
				`unknown command: ${product.id} ${rest.join(' ')}`,
				`Run \`magic ${product.id} --help\` for usage.`
			);
		}
		let { cmd } = matched;
		let args = matched.args;
		let parsedArgs = parseCommandArgs(cmd, args);

		// A route switch hands the call to another operation (e.g. --mine).
		const routes = cmd.op.meta?.cli?.routes ?? {};
		const route = parsedArgs.switches.find((s) => routes[s]);
		if (route) {
			const target = cmds.find((c) => c.op.name === routes[route]);
			if (!target) throw new Error(`route --${route} names a missing operation`);
			cmd = target;
			args = args.filter((a) => a !== `--${route}`);
			parsedArgs = parseCommandArgs(cmd, args);
		}

		const input = buildInput(cmd, parsedArgs, productFlags, opts);
		const op = cmd.op;
		const config = productConfig(product, deps, {
			output: {
				json: opts.json,
				quiet: opts.quiet,
				...(opts.color === false ? { color: false } : {}),
			},
			...(opts.workspace ? { workspace: opts.workspace } : {}),
		});

		if (op.meta?.destructive) {
			if (!opts.yes) {
				throw usage(`${cmd.words.join(' ')} is destructive — re-run with --yes to confirm.`);
			}
			if (!config.allowDestructive) throw destructiveDisabled(product.id);
		}

		const ctx = await buildContext(product, config, deps, op.meta?.requiresSession !== false);
		const out = await op.run(input, ctx);
		render(out, opts, io);
		return 0;
	} catch (err) {
		return renderError(toMagicError(err, { product: product.id }), opts, io);
	}
}

export function destructiveDisabled(product: string): MagicError {
	return new MagicError('destructive_action_disabled', 'This action is destructive and disabled.', {
		product,
		hint: 'Set MAGIC_ALLOW_DESTRUCTIVE=1 to enable destructive operations.',
	});
}

function buildInput(
	cmd: Command,
	parsed: ReturnType<typeof parseCommandArgs>,
	productFlags: Record<string, string>,
	opts: CliGlobalOptions
): unknown {
	const cli = cmd.op.meta?.cli ?? {};
	const fields = describeFields(cmd.op.input);
	const has = (key: string): boolean => fields.some((f) => f.key === key);
	const raw = parsed.raw;

	for (const s of parsed.switches) Object.assign(raw, cli.presets?.[s] ?? {});
	if (cli.fileInput && parsed.file !== undefined)
		raw[cli.fileInput] = loadFileInput(parsed.file, cli.fileInput);
	for (const [key, value] of Object.entries(productFlags)) {
		if (has(key) && raw[key] === undefined) raw[key] = value;
	}
	if (opts.workspace) {
		if (!has('workspace')) {
			throw usage(`--workspace is not supported by ${cmd.words.join(' ')}`);
		}
		if (raw.workspace === undefined) raw.workspace = opts.workspace;
	}

	const result = cmd.op.input.safeParse(coerce(raw, fields));
	if (!result.success) {
		const first = result.error.issues[0];
		const where = first?.path.length ? ` (${first.path.join('.')})` : '';
		throw usage(
			`${cmd.words.join(' ')}: invalid arguments${where}: ${first?.message ?? 'validation failed'}`
		);
	}
	return result.data;
}

/** `--file <path>`: a JSON array, or an object carrying the array under `key`. */
function loadFileInput(path: string, key: string): unknown[] {
	let text: string;
	try {
		text = readFileSync(path, 'utf8');
	} catch (err) {
		throw usage(`cannot read --file ${path}: ${(err as Error).message}`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (err) {
		throw usage(`--file ${path} is not valid JSON: ${(err as Error).message}`);
	}
	if (Array.isArray(parsed)) return parsed;
	const inner =
		parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>)[key] : undefined;
	if (Array.isArray(inner)) return inner;
	throw usage(`--file ${path} must be a JSON array (or { "${key}": [...] }).`);
}

/** `magic <product> --help`: nouns and verbs derived from the registry. */
export function helpText(product: ProductModule, cmds: Command[]): string {
	const lines = [
		`magic ${product.id} — ${product.title}`,
		'',
		`Usage: magic ${product.id} <command> [args] [--flags]`,
		'',
		'Commands:',
	];
	const rows: [string, string][] = cmds.map((c) => {
		const last = c.words[c.words.length - 1]!;
		const verb = c.verbAliases.length ? `${last} (${c.verbAliases.join(', ')})` : last;
		const name = [...c.words.slice(0, -1), verb].join(' ');
		const pos = c.positionals.map((p) => `<${p}>`).join(' ');
		return [`${name} ${pos}`.trim(), summaryOf(c.op)];
	});
	for (const [name, cmd] of Object.entries(product.commands ?? {})) rows.push([name, cmd.summary]);
	const width = Math.min(40, Math.max(...rows.map(([n]) => n.length)) + 2);
	for (const [name, summary] of rows) lines.push(`  ${name.padEnd(width)}${summary}`);
	lines.push('');
	const pf = (product.globalFlags ?? []).map((f) => ` --${f} <${f}>`).join('');
	lines.push(`Flags: --json --yes/-y --no-color --quiet/-q --workspace <handle>${pf}`);
	return `${lines.join('\n')}\n`;
}

function summaryOf(op: Operation): string {
	return op.meta?.destructive ? `${op.summary} [destructive]` : op.summary;
}
