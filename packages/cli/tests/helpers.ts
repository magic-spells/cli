// Shared fakes for the shell's tests: captured streams and an in-memory store.

import type { CredentialStore, RenderIO } from '@magic-spells/kit';

import { run, type ShellDeps } from '../src/main.js';
import { PRODUCTS } from '../src/products.js';

/** Nothing listens on port 9: a URL that fails fast, so no test reaches production. */
export const DEAD_URL = 'http://127.0.0.1:9';

export const PYRAMID_ONLY = PRODUCTS.filter((p) => p.id === 'pyramid');

export function memoryStore(initial: Record<string, string> = {}): CredentialStore & {
	items: Record<string, string>;
} {
	const items = { ...initial };
	return {
		items,
		backend: 'keyring',
		get: async (item) => items[item] ?? null,
		locate: async (item) => (item in items ? 'keyring' : null),
		set: async (item, secret) => void (items[item] = secret),
		delete: async (item) => void delete items[item],
	};
}

export interface Ran {
	code: number;
	stdout: string;
	stderr: string;
}

/**
 * Run `magic …` in-process with captured streams; no config file is read, no browser
 * opens, no question is asked, and Account, Sites and Marketing point at a dead port
 * unless the test says otherwise.
 */
export async function magic(
	argv: string[],
	deps: ShellDeps & { tty?: boolean } = {}
): Promise<Ran> {
	const cap = { stdout: '', stderr: '' };
	const io: RenderIO = {
		out: (t) => void (cap.stdout += t),
		err: (t) => void (cap.stderr += t),
		isTTY: () => deps.tty ?? false,
	};
	const code = await run(argv, {
		store: memoryStore(),
		openBrowser: async () => false,
		confirm: null,
		...deps,
		env: {
			XDG_CONFIG_HOME: '/nonexistent',
			MAGIC_ACCOUNT_URL: DEAD_URL,
			MAGIC_SITES_URL: DEAD_URL,
			MAGIC_MARKETING_URL: DEAD_URL,
			...deps.env,
		},
		io,
	});
	return { code, ...cap };
}
