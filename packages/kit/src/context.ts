// Building an OpContext for a product: config, credential, client.

import { loadCliConfig, readConfigFile, type CliConfig, type CliOutput } from './config.js';
import { resolveCredential, type ProductSession } from './credentials.js';
import type { CredentialStore } from './keychain.js';
import type { OpContext, ProductModule } from './operation.js';

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
	let session: ProductSession | null = null;
	if (requiresSession) {
		session = await resolveCredential(product, { env: deps.env ?? process.env, store: deps.store });
	}
	return {
		config,
		session,
		client: product.client(session ?? { product: product.id, key: '', source: 'env' }, config),
		signal: deps.signal ?? new AbortController().signal,
	};
}
