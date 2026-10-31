// Account grant and product sessions in the store (DATATYPE-ACCOUNT-CLI-GRANT,
// DATATYPE-PRODUCT-SESSION, FLOW-PRODUCT-SESSION-MINT). Products are data here: a
// product that declares `sessions: { path }` gets minted; the kit names none.
//
// Store items (service io.magicspells.cli, DATATYPE-KEYCHAIN-ENTRY):
//   account:grant        the Account cli grant (StoredGrant)
//   account:sessions     which workspaces each product minted, and its default (SessionIndex);
//                        the store cannot list items, so logout and whoami read this
//   <product>:<handle>   one ProductSession per workspace, source "account"
//   <product>:manual     a pasted key (credentials.ts), source "manual", never re-minted

import { hostname } from 'node:os';

import { GRANT_PREFIX, type AccountToken, type Fetch } from './account.js';
import { productEnvVar } from './config.js';
import type { ProductSession } from './credentials.js';
import { MagicError, mapHttpError, toMagicError } from './errors.js';
import type { CredentialStore } from './keychain.js';
import { rec, readStr } from './read.js';

export const GRANT_ITEM = 'account:grant';
export const SESSIONS_ITEM = 'account:sessions';
/** Account ends a grant after this long without use (its idle rule). */
export const GRANT_IDLE_MS = 14 * 24 * 60 * 60 * 1000;

export function sessionItem(product: string, handle: string): string {
	return `${product}:${handle}`;
}

export interface GrantUser {
	id: string;
	display_name: string;
	email: string;
}

export interface StoredGrant {
	/** Opaque `magic_…`; Bearer for every product's sessions route. Never printed. */
	access_token: string;
	grant_id: string;
	token_type: 'Bearer';
	obtained_at: string;
	/** obtained_at + expires_in (60 days absolute). */
	expires_at: string;
	/** The last successful mint: Account's idle clock restarts on each introspection. */
	last_used_at: string;
	/** From the first product that could say who this is; absent until then. */
	user?: GrantUser;
	/** Which Account issued it. */
	account_url: string;
}

export interface Workspace {
	id: string;
	handle: string;
	name: string;
	role: string;
}

export interface ProductSessionIndex {
	workspaces: Workspace[];
	/** Set when exactly one workspace was minted. */
	default?: string;
	minted_at: string;
}

export type SessionIndex = Record<string, ProductSessionIndex>;

export interface CliSessionsResponse {
	sessions: ProductSession[];
	workspaces: Workspace[];
	/** Optional: who the grant belongs to, when the product says. Fills the grant's `user`. */
	user?: GrantUser;
}

/** What minting needs from a product module. */
export interface SessionSpec {
	id: string;
	title: string;
	credential: string;
	sessions?: { path: string };
}

export function grantFromToken(
	token: AccountToken,
	accountUrl: string,
	now: Date = new Date()
): StoredGrant {
	return {
		access_token: token.access_token,
		grant_id: token.grant_id,
		token_type: 'Bearer',
		obtained_at: now.toISOString(),
		expires_at: new Date(now.getTime() + token.expires_in * 1000).toISOString(),
		last_used_at: now.toISOString(),
		account_url: accountUrl,
	};
}

/** When Account will end the grant for disuse: last use + 14 days, capped at expiry. */
export function grantIdleExpiry(grant: StoredGrant): string {
	const idle = Date.parse(grant.last_used_at) + GRANT_IDLE_MS;
	const hard = Date.parse(grant.expires_at);
	return new Date(Math.min(idle, hard)).toISOString();
}

export function grantExpired(grant: StoredGrant, now: number = Date.now()): boolean {
	return Date.parse(grantIdleExpiry(grant)) <= now;
}

/** The stored grant, or null (missing, unreadable, or not a `magic_` token). */
export async function readGrant(store: CredentialStore): Promise<StoredGrant | null> {
	const raw = await store.get(GRANT_ITEM);
	if (!raw) return null;
	try {
		const g = JSON.parse(raw) as Partial<StoredGrant>;
		if (typeof g.access_token !== 'string' || !g.access_token.startsWith(GRANT_PREFIX)) return null;
		return g as StoredGrant;
	} catch {
		return null;
	}
}

export async function saveGrant(store: CredentialStore, grant: StoredGrant): Promise<void> {
	await store.set(GRANT_ITEM, JSON.stringify(grant));
}

export async function readIndex(store: CredentialStore): Promise<SessionIndex> {
	const raw = await store.get(SESSIONS_ITEM);
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw) as unknown;
		return parsed && typeof parsed === 'object' ? (parsed as SessionIndex) : {};
	} catch {
		return {};
	}
}

async function saveIndex(store: CredentialStore, index: SessionIndex): Promise<void> {
	if (Object.keys(index).length === 0) await store.delete(SESSIONS_ITEM);
	else await store.set(SESSIONS_ITEM, JSON.stringify(index));
}

/** An account session as stored, or null. */
export async function readSession(
	store: CredentialStore,
	product: string,
	handle: string
): Promise<ProductSession | null> {
	const raw = await store.get(sessionItem(product, handle));
	if (!raw) return null;
	try {
		const s = JSON.parse(raw) as Partial<ProductSession>;
		return typeof s.key === 'string' && s.key.length > 0
			? { ...s, product, key: s.key, source: 'account' }
			: null;
	} catch {
		return null;
	}
}

/**
 * `magic on <hostname>`: how the key is labelled in the product's key list. Capped at
 * 80 characters, the shortest label limit any product sets (a longer one is refused).
 */
export function sessionLabel(host: string = hostname()): string {
	return `magic on ${host}`.slice(0, 80);
}

export interface MintOptions {
	apiUrl: string;
	/** The Account grant (`magic_…`). */
	grant: string;
	/** Mint one workspace only (re-mint). */
	workspace?: string;
	label?: string;
	fetch?: Fetch;
	signal?: AbortSignal;
}

/**
 * `POST <api><sessions.path>` with `Authorization: Bearer <grant>` and
 * `{ workspace?, label }`. 401 (grant_invalid) is not_logged_in: the grant is dead.
 */
export async function mintSessions(
	spec: SessionSpec,
	opts: MintOptions
): Promise<CliSessionsResponse> {
	const path = spec.sessions?.path;
	if (!path) throw new Error(`${spec.id} declares no sessions route`);
	const body: Record<string, string> = { label: opts.label ?? sessionLabel() };
	if (opts.workspace) body.workspace = opts.workspace;
	const res = await call(spec, opts, opts.apiUrl + path, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${opts.grant}`,
			'content-type': 'application/json',
			accept: 'application/json',
		},
		body: JSON.stringify(body),
	});
	if (!res.ok) throw sessionError(spec, res.status, res.body);
	return readSessions(spec, res.body);
}

/** `DELETE <api><sessions.path>` with the product key: revokes every key from that grant. */
export async function revokeSessions(
	spec: SessionSpec,
	opts: { apiUrl: string; key: string; fetch?: Fetch; signal?: AbortSignal }
): Promise<void> {
	const path = spec.sessions?.path;
	if (!path) throw new Error(`${spec.id} declares no sessions route`);
	const res = await call(spec, opts, opts.apiUrl + path, {
		method: 'DELETE',
		headers: { authorization: `Bearer ${opts.key}`, accept: 'application/json' },
	});
	if (!res.ok) {
		throw mapHttpError(res.status, res.body, { product: spec.id, title: spec.title });
	}
}

async function call(
	spec: SessionSpec,
	opts: { fetch?: Fetch; signal?: AbortSignal },
	url: string,
	init: RequestInit
): Promise<{ ok: boolean; status: number; body: unknown }> {
	let res: Response;
	try {
		res = await (opts.fetch ?? fetch)(url, {
			...init,
			...(opts.signal ? { signal: opts.signal } : {}),
		});
	} catch (err) {
		const e = toMagicError(err, {
			product: spec.id,
			networkHint: `Check ${productEnvVar(spec.id, 'URL')} and your network connection.`,
		});
		const cause =
			err instanceof Error && err.cause instanceof Error ? `: ${err.cause.message}` : '';
		throw cause
			? new MagicError(e.code, `${e.message}${cause}`, {
					product: e.product,
					...(e.hint ? { hint: e.hint } : {}),
				})
			: e;
	}
	const text = await res.text().catch(() => '');
	let body: unknown = null;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		body = null;
	}
	return { ok: res.ok, status: res.status, body };
}

function sessionError(spec: SessionSpec, status: number, body: unknown): MagicError {
	const code = readStr(rec(rec(body).error).code);
	if (status === 401) {
		return new MagicError('not_logged_in', 'Your Magic Spells sign-in is no longer valid.', {
			product: spec.id,
			hint: 'Run `magic login`.',
		});
	}
	if (status === 403 && code === 'no_workspaces') {
		return new MagicError('permission_denied', `You have no ${spec.title} workspaces.`, {
			product: spec.id,
			details: { reason: 'no_workspaces' },
		});
	}
	if (status === 404) {
		return new MagicError('not_found', `No ${spec.title} workspace by that handle.`, {
			product: spec.id,
			details: { kind: 'workspace' },
		});
	}
	return mapHttpError(status, body, { product: spec.id, title: spec.title });
}

/** Check the answer: every key carries the product's prefix and a workspace handle. */
function readSessions(spec: SessionSpec, body: unknown): CliSessionsResponse {
	const b = rec(body);
	const raw = Array.isArray(b.sessions) ? b.sessions : [];
	const sessions: ProductSession[] = [];
	for (const item of raw) {
		const s = rec(item);
		const key = readStr(s.key);
		const ws = rec(s.workspace);
		const handle = readStr(ws.handle);
		if (!key || !key.startsWith(spec.credential) || !handle) {
			throw new MagicError('unknown', `${spec.title} answered with a malformed session.`, {
				product: spec.id,
			});
		}
		sessions.push({
			product: spec.id,
			key,
			...(readStr(s.key_id) ? { key_id: readStr(s.key_id)! } : {}),
			workspace: { id: readStr(ws.id) ?? '', handle, name: readStr(ws.name) ?? handle },
			...(readStr(s.role) ? { role: readStr(s.role)! } : {}),
			...(readStr(s.expires_at) ? { expires_at: readStr(s.expires_at)! } : {}),
			source: 'account',
		});
	}
	const workspaces: Workspace[] = (Array.isArray(b.workspaces) ? b.workspaces : []).flatMap(
		(item) => {
			const w = rec(item);
			const handle = readStr(w.handle);
			if (!handle) return [];
			return [
				{
					id: readStr(w.id) ?? '',
					handle,
					name: readStr(w.name) ?? handle,
					role: readStr(w.role) ?? '',
				},
			];
		}
	);
	const u = rec(b.user);
	const email = readStr(u.email);
	const user: GrantUser | undefined = email
		? { id: readStr(u.id) ?? '', display_name: readStr(u.display_name) ?? email, email }
		: undefined;
	return { sessions, workspaces, ...(user ? { user } : {}) };
}

/**
 * Store a login's mint for one product: one item per session, the index entry
 * replaced (items for workspaces no longer minted are deleted), the default set when
 * exactly one workspace came back.
 */
export async function storeSessions(
	store: CredentialStore,
	product: string,
	res: CliSessionsResponse,
	now: Date = new Date()
): Promise<ProductSessionIndex> {
	const index = await readIndex(store);
	const handles = new Set(res.sessions.map((s) => s.workspace!.handle));
	for (const old of index[product]?.workspaces ?? []) {
		if (!handles.has(old.handle)) await store.delete(sessionItem(product, old.handle));
	}
	for (const s of res.sessions) {
		await store.set(sessionItem(product, s.workspace!.handle), JSON.stringify(s));
	}
	const workspaces: Workspace[] = res.sessions.map((s) => {
		const listed = res.workspaces.find((w) => w.handle === s.workspace!.handle);
		return {
			id: s.workspace!.id || listed?.id || '',
			handle: s.workspace!.handle,
			name: s.workspace!.name || listed?.name || s.workspace!.handle,
			role: s.role ?? listed?.role ?? '',
		};
	});
	const entry: ProductSessionIndex = {
		workspaces,
		...(workspaces.length === 1 ? { default: workspaces[0]!.handle } : {}),
		minted_at: now.toISOString(),
	};
	index[product] = entry;
	await saveIndex(store, index);
	return entry;
}

/** Every stored account session of one product, in index order. */
export async function productSessions(
	store: CredentialStore,
	product: string
): Promise<ProductSession[]> {
	const entry = (await readIndex(store))[product];
	const out: ProductSession[] = [];
	for (const w of entry?.workspaces ?? []) {
		const s = await readSession(store, product, w.handle);
		if (s) out.push(s);
	}
	return out;
}

/** Delete one product's account sessions and its index entry. */
export async function forgetSessions(store: CredentialStore, product: string): Promise<string[]> {
	const index = await readIndex(store);
	const entry = index[product];
	if (!entry) return [];
	const items = entry.workspaces.map((w) => sessionItem(product, w.handle));
	for (const item of items) await store.delete(item);
	delete index[product];
	await saveIndex(store, index);
	return items;
}

/** Mark the grant used now (Account's idle clock restarted on the mint). */
export async function touchGrant(store: CredentialStore, grant: StoredGrant): Promise<StoredGrant> {
	const touched = { ...grant, last_used_at: new Date().toISOString() };
	await saveGrant(store, touched);
	return touched;
}

/**
 * Re-mint one expired account session (FLOW-PRODUCT-SESSION-MINT "Re-mint"): the same
 * product and workspace, from the stored grant. No grant, or a dead one, is
 * not_logged_in with "run magic login".
 *
 * Contract with the products: an expired product key is answered with 401 and an
 * error code containing `expired` (e.g. `{ "error": { "code": "key_expired" } }`).
 * mapHttpError turns that into auth_expired, and only auth_expired triggers this.
 */
export async function remintSession(
	spec: SessionSpec,
	session: ProductSession,
	opts: { store: CredentialStore; apiUrl: string; fetch?: Fetch; signal?: AbortSignal }
): Promise<ProductSession> {
	const grant = await readGrant(opts.store);
	const handle = session.workspace?.handle;
	if (!grant || !handle) {
		throw new MagicError('not_logged_in', `Your ${spec.title} session has expired.`, {
			product: spec.id,
			hint: 'Run `magic login`.',
		});
	}
	const res = await mintSessions(spec, {
		apiUrl: opts.apiUrl,
		grant: grant.access_token,
		workspace: handle,
		...(opts.fetch ? { fetch: opts.fetch } : {}),
		...(opts.signal ? { signal: opts.signal } : {}),
	});
	const fresh = res.sessions.find((s) => s.workspace?.handle === handle);
	if (!fresh) {
		throw new MagicError(
			'not_found',
			`You no longer reach the ${spec.title} workspace "${handle}".`,
			{
				product: spec.id,
				details: { kind: 'workspace' },
				hint: 'Run `magic login` to refresh your workspaces.',
			}
		);
	}
	await opts.store.set(sessionItem(spec.id, handle), JSON.stringify(fresh));
	await touchGrant(opts.store, grant);
	return fresh;
}
