// Update lookups for `magic update` and the update notice (COMPONENT-UPGRADE): the
// latest version on the npm registry, how this binary was installed, and the
// once-a-day check cached in config.json under `updateCheck`.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { get as httpGet, type IncomingMessage } from 'node:http';
import { get as httpsGet } from 'node:https';
import { dirname } from 'node:path';

import type { ConfigFile } from './config.js';
import { MagicError } from './errors.js';

export const UPDATE_REGISTRY_URL = 'https://registry.npmjs.org/magic-spells/latest';

/** The only version strings ever handed to npm: the registry answer is untrusted. */
export const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/** At most one registry request per day for the notice. */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type InstallMethod = 'npm-global' | 'npx' | 'other';

/** config.json `updateCheck`. */
export interface UpdateCheck {
	checkedAt: string;
	latest: string;
}

export interface FetchLatestOptions {
	timeoutMs: number;
	/** Let the process exit while the request is in flight (the background check). */
	unref?: boolean;
}

/** The registry's `latest` version; rejects on a transport failure, a non-200 or a bad version. */
export function fetchLatestVersion(url: string, opts: FetchLatestOptions): Promise<string> {
	return new Promise((resolve, reject) => {
		const get = url.startsWith('https:') ? httpsGet : httpGet;
		const req = get(url, { headers: { accept: 'application/json' } }, (res: IncomingMessage) => {
			if (res.statusCode !== 200) {
				res.resume();
				reject(new Error(`The npm registry answered HTTP ${res.statusCode}.`));
				return;
			}
			let body = '';
			res.setEncoding('utf8');
			res.on('data', (chunk: string) => (body += chunk));
			res.on('error', reject);
			res.on('end', () => {
				let version: unknown;
				try {
					version = (JSON.parse(body) as { version?: unknown }).version;
				} catch {
					// Falls through to the invalid-version rejection.
				}
				if (typeof version === 'string' && VERSION_PATTERN.test(version)) resolve(version);
				else reject(new Error('The npm registry answered without a valid version.'));
			});
		});
		const timer = setTimeout(() => {
			const err = Object.assign(new Error('The npm registry did not answer in time.'), {
				code: 'ETIMEDOUT',
			});
			req.destroy(err);
		}, opts.timeoutMs);
		req.on('close', () => clearTimeout(timer));
		req.on('error', reject);
		if (opts.unref) {
			timer.unref();
			req.on('socket', (socket) => socket.unref());
		}
	});
}

/** True when `latest` is a later version than `current`; a release beats its prerelease. */
export function isNewer(latest: string, current: string): boolean {
	const parse = (v: string): [number[], boolean] => {
		const [core = '', pre] = v.split('-', 2);
		return [core.split('.').map(Number), pre !== undefined];
	};
	const [a, aPre] = parse(latest);
	const [b, bPre] = parse(current);
	for (let i = 0; i < 3; i++) {
		if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
	}
	return bPre && !aPre;
}

/**
 * Windows global roots: npm's default (%AppData%\npm), the Node installer's own folder
 * (nodejs), nvm-windows (nvm\v<version>) and Volta. A project's node_modules is not one.
 */
const WINDOWS_GLOBAL =
	/\\(npm|nodejs|nvm\\v[^\\]+|volta\\tools\\image\\packages\\magic-spells)\\node_modules\\magic-spells\\/i;

/** How the binary at `binPath` (its realpath) was installed. */
export function installMethod(binPath: string): InstallMethod {
	if (/[/\\]_npx[/\\]/.test(binPath)) return 'npx';
	if (binPath.includes('/lib/node_modules/magic-spells/')) return 'npm-global';
	if (WINDOWS_GLOBAL.test(binPath)) return 'npm-global';
	return 'other';
}

/** The cached check from the config file; anything malformed is no cache. */
export function readUpdateCheck(file: ConfigFile | null): UpdateCheck | null {
	const c = file?.updateCheck;
	if (!c || typeof c.checkedAt !== 'string' || typeof c.latest !== 'string') return null;
	if (!VERSION_PATTERN.test(c.latest) || Number.isNaN(Date.parse(c.checkedAt))) return null;
	return { checkedAt: c.checkedAt, latest: c.latest };
}

/** True when there is no cached check or it is a day old. */
export function updateCheckDue(check: UpdateCheck | null, now: number): boolean {
	return !check || now - Date.parse(check.checkedAt) >= UPDATE_CHECK_INTERVAL_MS;
}

/**
 * Store the check in config.json, keeping every other key the file holds. A file that
 * exists but does not parse is the person's to fix: it is left alone, never replaced.
 * Written to a temp file and renamed so a concurrent reader never sees half a file.
 */
export function writeUpdateCheck(path: string, check: UpdateCheck): void {
	let text: string | null = null;
	try {
		text = readFileSync(path, 'utf8');
	} catch {
		// No file yet: start a fresh one.
	}
	let file: Record<string, unknown> = {};
	if (text !== null) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			return;
		}
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
		file = parsed as Record<string, unknown>;
	}
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	const tmp = `${path}.${process.pid}.tmp`;
	writeFileSync(tmp, `${JSON.stringify({ ...file, updateCheck: check }, null, 2)}\n`);
	renameSync(tmp, path);
}

/** The notice line, or null when `latest` is not newer. */
export function updateNotice(current: string, latest: string): string | null {
	return isNewer(latest, current)
		? `A newer magic is available: ${latest} (you have ${current}). Run \`magic update\`.`
		: null;
}

/** A registry failure as the envelope `magic update` reports. */
export function registryError(err: unknown): MagicError {
	const message = err instanceof Error ? err.message : 'The npm registry could not be reached.';
	return new MagicError('network', message, {
		hint: 'Check your connection, or run npm install -g magic-spells@latest.',
	});
}
