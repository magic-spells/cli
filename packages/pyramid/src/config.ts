// Env + keychain -> PyramidConfig (FILE-CONFIG, DATATYPE-MCP-CONFIG, DOC-CREDENTIAL-STORAGE).
//
// Read & validated once at startup. The API key resolves PYRAMID_API_KEY (env) ->
// OS keychain -> error (FLOW-CREDENTIAL-RESOLUTION). Throws a PLAIN Error (not an
// McpError, not a stack dump) when no key is found or it is invalid — bin/pyramid
// catches it, writes `message` to STDERR as one line, and exits non-zero. The API
// key is NEVER logged.

import { getKey } from './keychain.js';
import type { PyramidConfig } from './types.js';

// The API lives at the `api.` subdomain; the bare host serves the web app.
const DEFAULT_BASE_URL = 'https://api.pyramid.magicspells.io';

/**
 * Read & validate configuration into a PyramidConfig.
 *
 * The API key resolves `PYRAMID_API_KEY` (env) -> OS keychain -> error. Throws a
 * plain `Error` with a clear, one-line message (no stack dump) when no key is
 * found or it does not start with `pyk_`. Defaults `baseUrl` to the production
 * host; `allowDestructive` is true only when `PYRAMID_ALLOW_DESTRUCTIVE === '1'`.
 *
 * @param env          defaults to process.env (injectable for tests).
 * @param readKeychain keychain reader; defaults to the real `getKey` (injectable
 *                     so the resolution order is testable without the keychain).
 */
export function loadConfig(
	env: NodeJS.ProcessEnv = process.env,
	readKeychain: () => string | null = getKey
): PyramidConfig {
	// Resolution order: PYRAMID_API_KEY (env) -> OS keychain -> error.
	const envKey = env.PYRAMID_API_KEY?.trim();
	const apiKey = envKey && envKey.length > 0 ? envKey : (readKeychain() ?? undefined);
	if (!apiKey || apiKey.trim() === '') {
		throw new Error(
			'No Pyramid API key found. Set PYRAMID_API_KEY or run `pyramid set-key <pyk_...>` ' +
				'(generate a key in Pyramid → Settings → API Keys).'
		);
	}
	if (!apiKey.startsWith('pyk_')) {
		throw new Error('Pyramid API key must start with "pyk_".');
	}

	const baseUrl = normalizeBaseUrl(env.PYRAMID_BASE_URL ?? DEFAULT_BASE_URL);
	const allowDestructive = env.PYRAMID_ALLOW_DESTRUCTIVE === '1';

	return { apiKey, baseUrl, allowDestructive };
}

/** Trim a single trailing slash and assert the value parses as a URL. */
function normalizeBaseUrl(value: string): string {
	const trimmed = value.endsWith('/') ? value.slice(0, -1) : value;
	try {
		// Validate it parses; keep the trimmed string (not the URL's href) so any
		// base path is preserved verbatim.
		new URL(trimmed);
	} catch {
		throw new Error(`PYRAMID_BASE_URL is not a valid URL: "${value}".`);
	}
	return trimmed;
}
