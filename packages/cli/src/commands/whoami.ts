// `magic whoami [--json]` (FEATURE-WHOAMI-DOCTOR, R0): per registered product, where
// its key comes from (env | keychain | file | none), the key masked, and the
// product's own identity from its `<product>.whoami` operation when the key works.
// Exit: the class of the first product error; not_logged_in (3) when no product has
// a key at all.

import {
	MagicError,
	cell,
	contextFor,
	exitCodeFor,
	jsonMode,
	manualItem,
	maskKey,
	productConfig,
	productEnvVar,
	render,
	resolveCredential,
	toMagicError,
	type MagicErrorShape,
	type ProductModule,
} from '@magic-spells/kit';

import {
	loadProducts,
	noMoreArgs,
	rejectWorkspace,
	storeLabel,
	wantsHelp,
	type Shell,
} from '../shell.js';

export interface ProductIdentity {
	source: 'env' | 'keychain' | 'file' | 'none';
	key: string | null;
	identity: unknown;
	error?: MagicErrorShape;
}

export interface WhoamiResult {
	/** The Account identity arrives with R1's `magic login`. */
	account: null;
	products: Record<string, ProductIdentity>;
}

export async function whoami(shell: Shell, argv: string[]): Promise<number> {
	if (wantsHelp(argv)) {
		shell.io.err('Usage: magic whoami [--json]\n\nWho each product key belongs to.\n');
		return 0;
	}
	rejectWorkspace('whoami', shell.opts);
	noMoreArgs('whoami', argv);

	const result: WhoamiResult = { account: null, products: {} };
	let firstError: MagicError | undefined;
	for (const product of await loadProducts(shell)) {
		const entry = await identify(shell, product);
		result.products[product.id] = entry.identity;
		firstError ??= entry.error;
	}

	if (jsonMode(shell.opts, shell.io)) render(result, shell.opts, shell.io);
	else printHuman(shell, result);

	if (firstError) return exitCodeFor(firstError.code);
	if (Object.values(result.products).every((p) => p.source === 'none')) {
		if (!shell.opts.quiet) shell.io.err('No product keys. Run `magic login --product-key`.\n');
		return exitCodeFor('not_logged_in');
	}
	return 0;
}

async function identify(
	shell: Shell,
	product: ProductModule
): Promise<{ identity: ProductIdentity; error?: MagicError }> {
	const source = shell.env[productEnvVar(product.id, 'KEY')]?.trim()
		? 'env'
		: storeLabel(await shell.store.locate(manualItem(product.id)));
	if (source === 'none') return { identity: { source, key: null, identity: null } };

	let key: string | null = null;
	try {
		const session = await resolveCredential(product, { env: shell.env, store: shell.store });
		key = maskKey(session.key, product.credential);
		const op = (await product.load()).find((o) => o.name === `${product.id}.whoami`);
		if (!op) return { identity: { source, key, identity: null } };
		const config = productConfig(product, shell);
		const identity = await op.run(op.input.parse({}), contextFor(product, config, session));
		return { identity: { source, key, identity } };
	} catch (err) {
		const error = toMagicError(err, { product: product.id });
		return { identity: { source, key, identity: null, error: error.toJSON() }, error };
	}
}

function printHuman(shell: Shell, result: WhoamiResult): void {
	const lines: string[] = [];
	for (const [id, p] of Object.entries(result.products)) {
		const rows: [string, string][] = [
			['source', p.source],
			...(p.key ? [['key', p.key] as [string, string]] : []),
		];
		if (p.identity && typeof p.identity === 'object') {
			for (const [k, v] of Object.entries(p.identity)) rows.push([k, cell(v)]);
		}
		if (p.error) rows.push(['error', `[${p.error.code}] ${p.error.message}`]);
		const width = Math.max(...rows.map(([k]) => k.length));
		lines.push(id, ...rows.map(([k, v]) => `  ${k.padEnd(width)}  ${v}`), '');
	}
	shell.io.out(lines.join('\n'));
}
