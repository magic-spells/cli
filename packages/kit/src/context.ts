// Building an OpContext for a product: config, credential, client; and the silent
// re-mint (FLOW-PRODUCT-SESSION-MINT "Re-mint"): an operation that fails auth_expired
// on an account session gets one fresh session from the Account grant and one retry.
// Manual and environment keys are never re-minted.

import { loadCliConfig, readConfigFile, type CliConfig, type CliOutput } from './config.js';
import { resolveCredential, type ProductSession } from './credentials.js';
import { isMagicError } from './errors.js';
import type { CredentialStore } from './keychain.js';
import type { OpContext, Operation, ProductModule } from './operation.js';
import { remintSession } from './sessions.js';

export interface ContextDeps {
	env?: NodeJS.ProcessEnv;
	store: CredentialStore;
	/** Defaults to reading ~/.config/magic/config.json. */
	readConfig?: () => ReturnType<typeof readConfigFile>;
	signal?: AbortSignal;
}

export function productConfig(
	product: Pick<ProductModule, 'id' | 'apiUrl'>,
	deps: Pick<ContextDeps, 'env' | 'readConfig'>,
	extra: { output?: Partial<CliOutput>; workspace?: string } = {}
): CliConfig {
	return loadCliConfig({
		products: [{ id: product.id, apiUrl: product.apiUrl }],
		env: deps.env ?? process.env,
		file: (deps.readConfig ?? (() => readConfigFile()))(),
		...extra,
	});
}

/** Config + session (when needed) + the product's client. */
export async function buildContext<C>(
	product: ProductModule<C>,
	config: CliConfig,
	deps: ContextDeps,
	requiresSession = true
): Promise<OpContext<C>> {
	const workspace = config.defaultWorkspace[product.id];
	const session = requiresSession
		? await resolveCredential(product, {
				env: deps.env ?? process.env,
				store: deps.store,
				...(workspace ? { workspace } : {}),
			})
		: null;
	return contextFor(product, config, session, deps.signal);
}

/** The context for an already-resolved session (null: a local-only operation). */
export function contextFor<C>(
	product: ProductModule<C>,
	config: CliConfig,
	session: ProductSession | null,
	signal: AbortSignal = new AbortController().signal
): OpContext<C> {
	return {
		config,
		session,
		client: product.client(session ?? { product: product.id, key: '', source: 'env' }, config),
		signal,
	};
}

/** Gives a context a fresh session, or null when its session cannot be re-minted. */
export type Remint<C = any> = (ctx: OpContext<C>) => Promise<OpContext<C> | null>;

/** The re-mint for one product, reading the grant from `store`. */
export function remintFor<C>(product: ProductModule<C>, store: CredentialStore): Remint<C> {
	return async (ctx) => {
		if (ctx.session?.source !== 'account' || !product.sessions) return null;
		const fresh = await remintSession(product, ctx.session, {
			store,
			apiUrl: ctx.config.products[product.id]!.apiUrl,
			signal: ctx.signal,
		});
		return contextFor(product, ctx.config, fresh, ctx.signal);
	};
}

/**
 * Run an operation; on auth_expired, re-mint once and retry once. Products signal an
 * expired key with 401 and an error code containing `expired` (e.g. `key_expired`);
 * any other 401 is auth_invalid and is never re-minted.
 */
export async function runWithRemint<C, O>(
	op: Operation<any, O, C>,
	input: unknown,
	ctx: OpContext<C>,
	remint?: Remint<C>
): Promise<O> {
	try {
		return await op.run(input, ctx);
	} catch (err) {
		if (!remint || !isMagicError(err) || err.code !== 'auth_expired') throw err;
		const fresh = await remint(ctx);
		if (!fresh) throw err;
		return op.run(input, fresh);
	}
}
