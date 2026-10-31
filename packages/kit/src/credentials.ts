// Product credentials (DATATYPE-PRODUCT-SESSION, DATATYPE-CLI-CONFIG "Credentials").
// Resolution: MAGIC_<PRODUCT>_KEY -> the account session for the chosen workspace
// (--workspace, the config file's default, or the only one minted) -> the store's
// `<product>:manual` item -> not_logged_in. Keys are read, never written, from the
// environment, and never accepted as flag values. Secrets are never printed: maskKey
// for display.

import type { CredentialStore } from './keychain.js';
import { MagicError } from './errors.js';
import { productEnvVar } from './config.js';
import { readIndex, readSession } from './sessions.js';

export interface ProductSession {
	product: string;
	/** Bearer for that product's API. */
	key: string;
	key_id?: string;
	workspace?: { id: string; handle: string; name: string };
	role?: string;
	expires_at?: string;
	/** env = from MAGIC_<PRODUCT>_KEY (never stored). */
	source: 'account' | 'manual' | 'env';
}

export interface CredentialSpec {
	/** Product id. */
	id: string;
	/** Display name. */
	title: string;
	/** Key prefix, e.g. `ack_`. */
	credential: string;
	/** Where to get a key, for hints. */
	keyHelp?: string;
	/** Present when the product mints sessions from the Account grant. */
	sessions?: { path: string };
}

/** The keychain item a pasted product key lives in. */
export function manualItem(product: string): string {
	return `${product}:manual`;
}

/** Show a key without its secret: the prefix and the last four characters. */
export function maskKey(key: string, prefix: string): string {
	const m = new RegExp(`^${escapeRegExp(prefix)}([^_]+)_(.+)$`).exec(key);
	if (!m) return `${prefix}…`;
	return `${prefix}${m[1]}_…${m[2]!.slice(-4)}`;
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Read a stored session; tolerates a bare key string from an older writer. */
export function parseStoredSession(product: string, value: string): ProductSession | null {
	try {
		const parsed = JSON.parse(value) as Partial<ProductSession>;
		if (parsed && typeof parsed.key === 'string' && parsed.key.length > 0) {
			return { ...parsed, product, key: parsed.key, source: parsed.source ?? 'manual' };
		}
	} catch {
		if (value.trim().length > 0) return { product, key: value.trim(), source: 'manual' };
	}
	return null;
}

function loginHint(spec: CredentialSpec): string {
	const where = spec.keyHelp ? ` (${spec.keyHelp})` : '';
	const manual = `${productEnvVar(spec.id, 'KEY')} or run \`magic login --product-key\` with a ${spec.credential}… key${where}.`;
	return spec.sessions ? `Run \`magic login\`, or set ${manual}` : `Set ${manual}`;
}

function checkPrefix(spec: CredentialSpec, key: string): void {
	if (!key.startsWith(spec.credential)) {
		throw new MagicError(
			'auth_invalid',
			`${spec.title} key must start with "${spec.credential}".`,
			{
				product: spec.id,
				hint: loginHint(spec),
			}
		);
	}
}

/**
 * Resolve the session for a product, or throw not_logged_in / auth_invalid, or
 * usage when several account workspaces exist and none is chosen. `workspace` is a
 * handle (--workspace or the config file's default).
 */
export async function resolveCredential(
	spec: CredentialSpec,
	opts: { env?: NodeJS.ProcessEnv; store: CredentialStore; workspace?: string }
): Promise<ProductSession> {
	const env = opts.env ?? process.env;
	const envKey = env[productEnvVar(spec.id, 'KEY')]?.trim();
	if (envKey) {
		checkPrefix(spec, envKey);
		return { product: spec.id, key: envKey, source: 'env' };
	}

	const minted = (await readIndex(opts.store))[spec.id];
	const handle = opts.workspace ?? minted?.default;
	if (minted && handle) {
		const account = await readSession(opts.store, spec.id, handle);
		if (account) {
			checkPrefix(spec, account.key);
			return account;
		}
		if (opts.workspace) {
			throw new MagicError('not_found', `No ${spec.title} session for workspace "${handle}".`, {
				product: spec.id,
				details: { kind: 'workspace' },
				candidates: minted.workspaces.map((w) => w.handle),
				hint: 'Pick one of the listed workspaces, or run `magic login` to refresh them.',
			});
		}
	}

	const stored = await opts.store.get(manualItem(spec.id));
	const session = stored ? parseStoredSession(spec.id, stored) : null;
	if (session) {
		checkPrefix(spec, session.key);
		return session;
	}
	if (minted && minted.workspaces.length > 1) {
		throw new MagicError('usage', `You have several ${spec.title} workspaces; choose one.`, {
			product: spec.id,
			candidates: minted.workspaces.map((w) => w.handle),
			hint: 'Pass --workspace <handle>, or set defaultWorkspace in the config file.',
		});
	}
	throw new MagicError('not_logged_in', `No ${spec.title} key found.`, {
		product: spec.id,
		hint: loginHint(spec),
	});
}

/** Store a pasted product key. Validates the prefix; never echoes the secret. */
export async function saveProductKey(
	spec: CredentialSpec,
	store: CredentialStore,
	key: string
): Promise<ProductSession> {
	const trimmed = key.trim();
	checkPrefix(spec, trimmed);
	const session: ProductSession = { product: spec.id, key: trimmed, source: 'manual' };
	await store.set(manualItem(spec.id), JSON.stringify(session));
	return session;
}

/** Forget a product's stored key. Idempotent. */
export async function forgetProductKey(
	spec: CredentialSpec,
	store: CredentialStore
): Promise<void> {
	await store.delete(manualItem(spec.id));
}
