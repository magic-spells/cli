// The credential store (COMPONENT-KEYCHAIN, DATATYPE-KEYCHAIN-ENTRY). One service,
// `io.magicspells.cli`, one item per credential; values are JSON strings.
//
// R0 backend: macOS Keychain through /usr/bin/security (pyramid-cli's path, no native
// dependency), else a 0600 JSON file with a stderr warning. MAGIC_CREDENTIALS_FILE=1
// forces the file, silently. R1 swaps the macOS path for a cross-platform keyring binding
// (FEATURE-KEYRING), which also takes the secret out of the `security -w` argv.
// Secrets are never logged.

import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { configDir, type PathEnv } from './paths.js';

export const KEYCHAIN_SERVICE = 'io.magicspells.cli';
const SECURITY = '/usr/bin/security';

export interface CredentialStore {
	/** Never throws; unavailable -> null. */
	get(item: string): Promise<string | null>;
	/** Which backend holds the item (the macOS store falls back to the file), or null. */
	locate(item: string): Promise<'keyring' | 'file' | null>;
	set(item: string, secret: string): Promise<void>;
	/** Idempotent. */
	delete(item: string): Promise<void>;
	/** Item names only, never values. */
	list(): Promise<string[]>;
	readonly backend: 'keyring' | 'file';
}

/** Run a binary, return stdout; throws on a non-zero exit. */
export type ExecFile = (file: string, args: string[]) => string;

export interface StoreOptions extends PathEnv {
	exec?: ExecFile;
	/** Where the file-fallback warning goes (stderr in production). */
	warn?: (line: string) => void;
}

export function credentialsFilePath(opts: PathEnv = {}): string {
	return join(configDir(opts), 'credentials.json');
}

const realExec: ExecFile = (file, args) =>
	execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

export function createCredentialStore(opts: StoreOptions = {}): CredentialStore {
	const platform = opts.platform ?? process.platform;
	const env = opts.env ?? process.env;
	// Asking for the file (MAGIC_CREDENTIALS_FILE=1) is a choice, not a fallback: no warning.
	const chosen = env.MAGIC_CREDENTIALS_FILE === '1';
	const warn = chosen ? () => {} : (opts.warn ?? defaultWarn);
	const file = createFileStore(credentialsFilePath(opts), warn);
	if (platform !== 'darwin' || chosen) return file;
	return createMacStore(opts.exec ?? realExec, file);
}

function defaultWarn(line: string): void {
	process.stderr.write(`${line}\n`);
}

// ============ File backend ============

interface FileShape {
	items: Record<string, string>;
}

export function createFileStore(path: string, warn: (line: string) => void): CredentialStore {
	let warned = false;
	const read = (): FileShape => {
		try {
			const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<FileShape>;
			return { items: parsed.items && typeof parsed.items === 'object' ? parsed.items : {} };
		} catch {
			return { items: {} };
		}
	};
	const write = (data: FileShape): void => {
		mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
		writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
		chmodSync(path, 0o600);
	};
	const value = (item: string): string | null => {
		const v = read().items[item];
		return typeof v === 'string' && v.length > 0 ? v : null;
	};
	return {
		backend: 'file',
		async get(item) {
			return value(item);
		},
		async locate(item) {
			return value(item) === null ? null : 'file';
		},
		async set(item, secret) {
			if (!warned) {
				warn(`warning: storing credentials in ${path} (mode 0600), not the OS keychain.`);
				warned = true;
			}
			const data = read();
			data.items[item] = secret;
			write(data);
		},
		async delete(item) {
			const data = read();
			if (!(item in data.items)) return;
			delete data.items[item];
			write(data);
		},
		async list() {
			return Object.keys(read().items);
		},
	};
}

// ============ macOS Keychain backend ============

function createMacStore(exec: ExecFile, file: CredentialStore): CredentialStore {
	const fromKeychain = (item: string): string | null => {
		try {
			const v = exec(SECURITY, [
				'find-generic-password',
				'-s',
				KEYCHAIN_SERVICE,
				'-a',
				item,
				'-w',
			]).trim();
			return v.length > 0 ? v : null;
		} catch {
			// Missing item or locked keychain.
			return null;
		}
	};
	return {
		backend: 'keyring',
		async get(item) {
			return fromKeychain(item) ?? file.get(item);
		},
		async locate(item) {
			return fromKeychain(item) !== null ? 'keyring' : file.locate(item);
		},
		async set(item, secret) {
			try {
				// -U updates in place. The secret rides in argv (no shell) until the
				// R1 keyring binding replaces this path.
				exec(SECURITY, [
					'add-generic-password',
					'-U',
					'-s',
					KEYCHAIN_SERVICE,
					'-a',
					item,
					'-w',
					secret,
				]);
			} catch {
				await file.set(item, secret);
			}
		},
		async delete(item) {
			try {
				exec(SECURITY, ['delete-generic-password', '-s', KEYCHAIN_SERVICE, '-a', item]);
			} catch {
				// Nothing stored: deletion is idempotent.
			}
			await file.delete(item);
		},
		async list() {
			let names: string[] = [];
			try {
				names = parseKeychainDump(exec(SECURITY, ['dump-keychain']));
			} catch {
				// Unavailable keychain: only the file's items.
			}
			return [...new Set([...names, ...(await file.list())])];
		},
	};
}

/**
 * Item names for our service out of `security dump-keychain` (attributes only, no
 * secrets). Each item block lists `"acct"<blob>="…"` and `"svce"<blob>="…"`.
 */
export function parseKeychainDump(dump: string): string[] {
	const names: string[] = [];
	for (const block of dump.split(/^keychain: /m)) {
		const svce = /"svce"<blob>="([^"]*)"/.exec(block)?.[1];
		const acct = /"acct"<blob>="([^"]*)"/.exec(block)?.[1];
		if (svce === KEYCHAIN_SERVICE && acct) names.push(acct);
	}
	return names;
}
