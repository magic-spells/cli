// COMPONENT-SHELL — the `magic` entry: top-level commands and product dispatch.
// Process concerns only; everything behind a product token is an operation run by
// the kit's runProductCli. Returns exit codes; bin/magic.js sets process.exitCode.

import {
	configFilePath,
	createCredentialStore,
	parseGlobals,
	processIO,
	readConfigFile,
	renderError,
	runProductCli,
	toMagicError,
	usage,
	type CliGlobalOptions,
	type CredentialStore,
	type RenderIO,
} from '@magic-spells/kit';

import { doctor } from './commands/doctor.js';
import { login, logout } from './commands/login.js';
import { serveMcp } from './commands/mcp.js';
import { whoami } from './commands/whoami.js';
import { PRODUCTS, type ProductEntry } from './products.js';
import { readSecret } from './secret.js';
import type { Shell } from './shell.js';
import { version } from './version.js';

export { version } from './version.js';

export interface ShellDeps {
	io?: RenderIO;
	env?: NodeJS.ProcessEnv;
	store?: CredentialStore;
	products?: ProductEntry[];
	readSecret?: (prompt: string) => Promise<string>;
}

const COMMANDS: Record<
	string,
	{ summary: string; run: (shell: Shell, args: string[]) => Promise<number> }
> = {
	login: { summary: 'store a product key: login --product-key [<product>]', run: login },
	logout: { summary: 'forget stored keys: logout [--product <product>]', run: logout },
	whoami: { summary: 'who each product key belongs to', run: whoami },
	doctor: { summary: 'check the install, the keys and each product', run: doctor },
	mcp: { summary: 'serve every product’s tools over stdio: mcp [--products a,b]', run: serveMcp },
};

function help(products: ProductEntry[]): string {
	const lines = [
		'magic — the command line for Magic Spells services',
		'',
		'Usage: magic <command> [args] [--flags]',
		'       magic <product> <noun> <verb> [args] [--flags]',
		'',
		'Commands:',
		...Object.entries(COMMANDS).map(([name, c]) => `  ${name.padEnd(21)}${c.summary}`),
		`  ${'version'.padEnd(21)}print the version`,
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
	const env = deps.env ?? process.env;
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

	const store = (): CredentialStore => deps.store ?? createCredentialStore({ env });
	const readConfig = () => readConfigFile(configFilePath({ env }));

	const entry = products.find((p) => p.id === cmd);
	if (entry) {
		const product = await entry.load();
		return runProductCli(product, rest, { io, env, store: store(), readConfig });
	}

	let opts: CliGlobalOptions = { json: argv.includes('--json'), yes: false, quiet: false };
	try {
		const command = COMMANDS[cmd];
		if (!command) throw usage(`unknown command "${cmd}"`, 'Run `magic --help` for usage.');
		const parsed = parseGlobals(rest, [], env);
		opts = parsed.opts;
		const shell: Shell = {
			io,
			env,
			store: store(),
			entries: products,
			opts,
			readConfig,
			readSecret: deps.readSecret ?? readSecret,
		};
		return await command.run(shell, parsed.rest);
	} catch (err) {
		return renderError(toMagicError(err), opts, io);
	}
}
