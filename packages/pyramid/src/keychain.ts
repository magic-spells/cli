// FILE-KEYCHAIN — OS keychain credential store for the Pyramid API key
// (DOC-CREDENTIAL-STORAGE, FLOW-CREDENTIAL-RESOLUTION).
//
// The shared read/write seam for the `pyk_` key. The CLI `set-key` / `logout`
// commands WRITE (setKey/deleteKey); config.ts READS (getKey) as the middle step
// of the `env -> keychain -> error` resolution. macOS uses the built-in
// `/usr/bin/security` (no native dependency); other platforms fall back to a
// chmod-600 JSON file. The key is NEVER logged.

import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const SERVICE = 'pyramid';
const ACCOUNT = 'default';
const SECURITY = '/usr/bin/security';
const isMac = process.platform === 'darwin';

/** chmod-600 fallback file for platforms without `security` (Linux/Windows). */
function fallbackPath(): string {
	return join(homedir(), '.config', 'pyramid', 'credentials.json');
}

/**
 * Read the stored API key, or `null` if none is stored / the keychain is
 * unavailable. NEVER throws — a missing item, a locked keychain, or a `security`
 * failure all resolve to `null`, so the `env -> keychain -> error` chain in
 * config.ts falls through cleanly.
 */
export function getKey(): string | null {
	try {
		if (isMac) {
			const out = execFileSync(
				SECURITY,
				['find-generic-password', '-s', SERVICE, '-a', ACCOUNT, '-w'],
				{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
			);
			const key = out.trim();
			return key.length > 0 ? key : null;
		}
		const parsed = JSON.parse(readFileSync(fallbackPath(), 'utf8')) as {
			apiKey?: unknown;
		};
		return typeof parsed.apiKey === 'string' && parsed.apiKey.length > 0 ? parsed.apiKey : null;
	} catch {
		return null;
	}
}

/**
 * Store the API key (CLI `set-key`). Overwrites any existing value; throws on
 * a genuine write failure so the CLI can report it.
 */
export function setKey(key: string): void {
	if (isMac) {
		// `-U` updates the item if it already exists. The key rides in the argv
		// array (no shell), briefly visible in the local process list — acceptable
		// for an interactive, one-time login on the user's own machine.
		execFileSync(
			SECURITY,
			['add-generic-password', '-U', '-s', SERVICE, '-a', ACCOUNT, '-w', key],
			{ stdio: ['ignore', 'ignore', 'ignore'] }
		);
		return;
	}
	const path = fallbackPath();
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify({ apiKey: key }, null, 2), { mode: 0o600 });
	chmodSync(path, 0o600);
}

/** Remove the stored API key (CLI `logout`). Idempotent. */
export function deleteKey(): void {
	try {
		if (isMac) {
			execFileSync(SECURITY, ['delete-generic-password', '-s', SERVICE, '-a', ACCOUNT], {
				stdio: ['ignore', 'ignore', 'ignore'],
			});
			return;
		}
		rmSync(fallbackPath(), { force: true });
	} catch {
		// Nothing stored / already gone — deletion is idempotent.
	}
}
