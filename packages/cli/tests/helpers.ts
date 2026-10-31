// Shared fakes for the shell's tests: captured streams and an in-memory store.

import type { CredentialStore, RenderIO } from '@magic-spells/kit';

import { run, type ShellDeps } from '../src/main.js';

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
		list: async () => Object.keys(items),
	};
}

export interface Ran {
	code: number;
	stdout: string;
	stderr: string;
}

/** Run `magic …` in-process with captured streams; no config file is read. */
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
		...deps,
		env: { XDG_CONFIG_HOME: '/nonexistent', ...deps.env },
		io,
	});
	return { code, ...cap };
}
