// COMPONENT-SHELL — the `magic` entry: top-level commands and product dispatch.
// Process concerns only; everything behind a product token is an operation.

import { readPackageVersion } from '@magic-spells/kit';

export interface ShellIO {
	out: (text: string) => void;
	err: (text: string) => void;
}

const realIO: ShellIO = {
	out: (text) => process.stdout.write(text),
	err: (text) => process.stderr.write(text),
};

export function version(): string {
	return readPackageVersion(import.meta.url);
}

function help(): string {
	return [
		'magic — the command line for Magic Spells services',
		'',
		'Usage: magic <command> [args] [--flags]',
		'',
		'Commands:',
		'  version              print the version',
		'',
		'Global flags: --json --yes/-y --no-color --quiet/-q --no-cache --version --help',
		'',
	].join('\n');
}

/** Run the shell and return the process exit code. */
export async function run(argv: string[], io: ShellIO = realIO): Promise<number> {
	const [cmd] = argv;
	if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
		io.out(`magic ${version()}\n`);
		return 0;
	}
	if (cmd === undefined || cmd === 'help' || cmd === '--help' || cmd === '-h') {
		io.err(help());
		return 0;
	}
	io.err(`error: unknown command "${cmd}"\nRun \`magic --help\` for usage.\n`);
	return 2;
}
