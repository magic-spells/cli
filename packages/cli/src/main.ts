// COMPONENT-SHELL — the `magic` entry: top-level commands and product dispatch.
// Process concerns only; everything behind a product token is an operation run by
// the kit's runProductCli. Returns exit codes; bin/magic.js sets process.exitCode.

import {
	createCredentialStore,
	readPackageVersion,
	renderError,
	runProductCli,
	usage,
	type CredentialStore,
	type RenderIO,
	processIO,
} from '@magic-spells/kit';

import { PRODUCTS, type ProductEntry } from './products.js';

export interface ShellDeps {
	io?: RenderIO;
	env?: NodeJS.ProcessEnv;
	store?: CredentialStore;
	products?: ProductEntry[];
}

export function version(): string {
	return readPackageVersion(import.meta.url);
}

function help(products: ProductEntry[]): string {
	const lines = [
		'magic — the command line for Magic Spells services',
		'',
		'Usage: magic <command> [args] [--flags]',
		'       magic <product> <noun> <verb> [args] [--flags]',
		'',
		'Commands:',
		'  version              print the version',
		'',
		'Products:',
		...products.map((p) => `  ${p.id.padEnd(21)}${p.title}`),
		'',
		'Global flags: --json --yes/-y --no-color --quiet/-q --workspace <handle> --version --help',
		'Run `magic <product> --help` for a product’s commands.',
		'',
	];
	return lines.join('\n');
}

/** Run the shell and return the process exit code. */
export async function run(argv: string[], deps: ShellDeps = {}): Promise<number> {
	const io = deps.io ?? processIO;
	const products = deps.products ?? PRODUCTS;
	const [cmd, ...rest] = argv;

	if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
		io.out(`magic ${version()}\n`);
		return 0;
	}
	if (cmd === undefined || cmd === 'help' || cmd === '--help' || cmd === '-h') {
		io.err(help(products));
		return 0;
	}

	const entry = products.find((p) => p.id === cmd);
	if (entry) {
		const product = await entry.load();
		return runProductCli(product, rest, {
			io,
			env: deps.env ?? process.env,
			store: deps.store ?? createCredentialStore({ env: deps.env ?? process.env }),
		});
	}

	return renderError(
		usage(`unknown command "${cmd}"`, 'Run `magic --help` for usage.'),
		{ json: argv.includes('--json'), yes: false, quiet: false },
		io
	);
}
