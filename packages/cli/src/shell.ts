// What every top-level command receives: streams, environment, the credential store,
// the registered products and the global flags (COMPONENT-SHELL).

import {
	MagicError,
	usage,
	type CliGlobalOptions,
	type ConfigFile,
	type CredentialStore,
	type ProductModule,
	type RenderIO,
} from '@magic-spells/kit';

import type { UpdateDeps } from './commands/update.js';
import type { ProductEntry } from './products.js';

export interface Shell {
	io: RenderIO;
	env: NodeJS.ProcessEnv;
	store: CredentialStore;
	entries: ProductEntry[];
	opts: CliGlobalOptions;
	/** The config file reader (honours XDG_CONFIG_HOME in `env`). */
	readConfig: () => ConfigFile | null;
	/** Read a secret: hidden TTY prompt, or stdin when piped. */
	readSecret: (prompt: string) => Promise<string>;
	/** Open a URL in the browser; false when it could not. */
	openBrowser: (url: string) => Promise<boolean>;
	/** Ask yes/no; null when stdin is not a terminal (then --yes is required). */
	confirm: ((question: string) => Promise<boolean>) | null;
	platform: NodeJS.Platform;
	/** Login waits, injected by tests: Ctrl-C, the device-poll clock, the loopback timeout. */
	login: LoginTiming;
	/** `magic update` seams, injected by tests: registry, bin path, the npm install. */
	update: UpdateDeps;
}

export interface LoginTiming {
	/** Aborts the sign-in like Ctrl-C (SIGINT is wired when absent). */
	interrupt?: AbortSignal;
	sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
	now?: () => number;
	loopbackTimeoutMs?: number;
}

/** The named product entries (all when `ids` is undefined); unknown ids are usage errors. */
export function chooseEntries(shell: Shell, ids?: string[]): ProductEntry[] {
	const known = shell.entries.map((e) => e.id);
	for (const id of ids ?? []) {
		if (!known.includes(id)) {
			throw usage(`unknown product "${id}"`, `Products: ${known.join(', ')}.`);
		}
	}
	return ids ? shell.entries.filter((e) => ids.includes(e.id)) : shell.entries;
}

/** Load the named products (all when `ids` is undefined). */
export async function loadProducts(shell: Shell, ids?: string[]): Promise<ProductModule[]> {
	return Promise.all(chooseEntries(shell, ids).map((e) => e.load()));
}

/** The value after `--name`, or `--name=value`; removes both tokens from `args`. */
export function takeValue(args: string[], name: string): string | undefined {
	for (let i = 0; i < args.length; i++) {
		const tok = args[i]!;
		if (tok === `--${name}`) {
			const v = args[i + 1];
			if (v === undefined || v.startsWith('--')) throw usage(`flag --${name} expects a value`);
			args.splice(i, 2);
			return v;
		}
		if (tok.startsWith(`--${name}=`)) {
			args.splice(i, 1);
			return tok.slice(name.length + 3);
		}
	}
	return undefined;
}

export function wantsHelp(args: string[]): boolean {
	return args.includes('--help') || args.includes('-h');
}

/** Remove a presence flag from `args`; true when it was there. */
export function takeSwitch(args: string[], name: string): boolean {
	const i = args.indexOf(`--${name}`);
	if (i < 0) return false;
	args.splice(i, 1);
	return true;
}

/** Leftover arguments are a usage error naming the command. */
export function noMoreArgs(command: string, args: string[]): void {
	if (args.length > 0) throw usage(`${command}: unexpected argument "${args[0]}"`);
}

/** Top-level commands act on every workspace a key reaches; --workspace does not apply. */
export function rejectWorkspace(command: string, opts: CliGlobalOptions): void {
	if (opts.workspace) throw usage(`--workspace is not supported by ${command}`);
}

/** The store item location as whoami and login report it. */
export function storeLabel(where: 'keyring' | 'file' | null): 'keychain' | 'file' | 'none' {
	return where === 'keyring' ? 'keychain' : (where ?? 'none');
}

export function cancelled(): MagicError {
	return new MagicError('usage', 'Cancelled.');
}
