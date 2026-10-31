// `magic whoami [--json]` (FEATURE-WHOAMI-DOCTOR): the Account identity (name, email,
// grant expiry, idle expiry) and, per product, where its key comes from (env | account
// | manual | none), its workspaces (handle, name, role, masked key, key expiry), the
// default, and the product's own identity from its `<product>.whoami` operation. Keys
// are only ever shown masked. Exit: the class of the first product error;
// not_logged_in (3) when there is no sign-in and no product key at all.

import {
	MagicError,
	cell,
	contextFor,
	exitCodeFor,
	grantIdleExpiry,
	jsonMode,
	manualItem,
	maskKey,
	productConfig,
	productEnvVar,
	productSessions,
	readGrant,
	readIndex,
	remintFor,
	render,
	resolveCredential,
	runWithRemint,
	sessionItem,
	toMagicError,
	type GrantUser,
	type MagicErrorShape,
	type ProductModule,
	type ProductSession,
} from '@magic-spells/kit';

import {
	loadProducts,
	noMoreArgs,
	rejectWorkspace,
	storeLabel,
	wantsHelp,
	type Shell,
} from '../shell.js';

export interface WorkspaceIdentity {
	handle: string;
	name: string;
	role: string;
	/** Masked. */
	key: string | null;
	expires_at: string | null;
}

export interface ProductIdentity {
	source: 'env' | 'account' | 'manual' | 'none';
	/** Where a stored key lives. */
	stored_in: 'keychain' | 'file' | null;
	/** The key commands use, masked. */
	key: string | null;
	default: string | null;
	workspaces: WorkspaceIdentity[];
	identity: unknown;
	error?: MagicErrorShape;
}

export interface AccountIdentity {
	user: GrantUser | null;
	grant_id: string;
	expires_at: string;
	idle_expires_at: string;
	account_url: string;
}

export interface WhoamiResult {
	account: AccountIdentity | null;
	products: Record<string, ProductIdentity>;
}

export async function whoami(shell: Shell, argv: string[]): Promise<number> {
	if (wantsHelp(argv)) {
		shell.io.err(
			'Usage: magic whoami [--json]\n\nYour account, and your workspaces and keys in each product.\n'
		);
		return 0;
	}
	rejectWorkspace('whoami', shell.opts);
	noMoreArgs('whoami', argv);

	const grant = await readGrant(shell.store);
	const result: WhoamiResult = {
		account: grant
			? {
					user: grant.user ?? null,
					grant_id: grant.grant_id,
					expires_at: grant.expires_at,
					idle_expires_at: grantIdleExpiry(grant),
					account_url: grant.account_url,
				}
			: null,
		products: {},
	};
	let firstError: MagicError | undefined;
	for (const product of await loadProducts(shell)) {
		const entry = await identify(shell, product);
		result.products[product.id] = entry.identity;
		firstError ??= entry.error;
	}

	if (jsonMode(shell.opts, shell.io)) render(result, shell.opts, shell.io);
	else printHuman(shell, result);

	if (firstError) return exitCodeFor(firstError.code);
	if (!result.account && Object.values(result.products).every((p) => p.source === 'none')) {
		if (!shell.opts.quiet) shell.io.err('Not logged in. Run `magic login`.\n');
		return exitCodeFor('not_logged_in');
	}
	return 0;
}

async function identify(
	shell: Shell,
	product: ProductModule
): Promise<{ identity: ProductIdentity; error?: MagicError }> {
	const id = product.id;
	const sessions = await productSessions(shell.store, id);
	const index = (await readIndex(shell.store))[id];
	const envSet = Boolean(shell.env[productEnvVar(id, 'KEY')]?.trim());
	const manualAt = await shell.store.locate(manualItem(id));
	const source: ProductIdentity['source'] = envSet
		? 'env'
		: sessions.length > 0
			? 'account'
			: manualAt
				? 'manual'
				: 'none';
	const stored = source === 'account' ? sessions[0]!.workspace!.handle : null;
	const base: ProductIdentity = {
		source,
		stored_in:
			source === 'account'
				? (storeLabel(await shell.store.locate(sessionItem(id, stored!))) as 'keychain' | 'file')
				: source === 'manual'
					? (storeLabel(manualAt) as 'keychain' | 'file')
					: null,
		key: null,
		default: index?.default ?? null,
		workspaces: workspaces(product, sessions, index?.workspaces ?? []),
		identity: null,
	};
	if (source === 'none') return { identity: base };

	let session: ProductSession;
	const config = productConfig(product, shell);
	try {
		const workspace = config.defaultWorkspace[id];
		session = await resolveCredential(product, {
			env: shell.env,
			store: shell.store,
			...(workspace ? { workspace } : {}),
		});
	} catch (err) {
		const error = toMagicError(err, { product: id });
		// Several workspaces and no default: whoami lists them; nothing is wrong.
		if (error.code === 'usage') return { identity: base };
		return { identity: { ...base, error: error.toJSON() }, error };
	}

	const identity = { ...base, key: maskKey(session.key, product.credential) };
	try {
		const op = (await product.load()).find((o) => o.name === `${id}.whoami`);
		if (!op) return { identity };
		const ctx = contextFor(product, config, session);
		const who = await runWithRemint(op, op.input.parse({}), ctx, remintFor(product, shell.store));
		return { identity: { ...identity, identity: who } };
	} catch (err) {
		const error = toMagicError(err, { product: id });
		return { identity: { ...identity, error: error.toJSON() }, error };
	}
}

function workspaces(
	product: ProductModule,
	sessions: ProductSession[],
	listed: { handle: string; name: string; role: string }[]
): WorkspaceIdentity[] {
	return listed.map((w) => {
		const s = sessions.find((x) => x.workspace?.handle === w.handle);
		return {
			handle: w.handle,
			name: w.name,
			role: w.role,
			key: s ? maskKey(s.key, product.credential) : null,
			expires_at: s?.expires_at ?? null,
		};
	});
}

function printHuman(shell: Shell, result: WhoamiResult): void {
	const lines: string[] = [];
	const a = result.account;
	if (a) {
		lines.push(a.user ? `${a.user.display_name} <${a.user.email}>` : 'Signed in');
		lines.push(
			`  signed in until ${day(a.expires_at)}; ends after ${day(a.idle_expires_at)} unused`
		);
	} else {
		lines.push('Not signed in to a Magic Spells account.');
	}
	lines.push('');
	for (const [id, p] of Object.entries(result.products)) {
		const rows: [string, string][] = [['source', p.source]];
		if (p.key) rows.push(['key', p.key]);
		for (const w of p.workspaces) {
			const mark = w.handle === p.default ? ' (default)' : '';
			const expires = w.expires_at ? `, key expires ${w.expires_at}` : '';
			rows.push([w.handle, `${w.name} · ${w.role}${w.key ? ` · ${w.key}` : ''}${mark}${expires}`]);
		}
		if (p.identity && typeof p.identity === 'object') {
			for (const [k, v] of Object.entries(p.identity)) rows.push([k, cell(v)]);
		}
		if (p.error) rows.push(['error', `[${p.error.code}] ${p.error.message}`]);
		const width = Math.max(...rows.map(([k]) => k.length));
		lines.push(id, ...rows.map(([k, v]) => `  ${k.padEnd(width)}  ${v}`), '');
	}
	shell.io.out(lines.join('\n'));
}

function day(iso: string): string {
	return iso.slice(0, 10);
}
