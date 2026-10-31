// `magic login --product-key [<product>]` and `magic logout [--product <p>]`
// (COMPONENT-LOGIN, R0 shapes). The key comes from a hidden prompt or piped stdin,
// never from argv; the product is the one named, or the one whose prefix the key
// carries. Account login (`magic login` alone) arrives with R1.

import {
	forgetProductKey,
	manualItem,
	maskKey,
	productEnvVar,
	render,
	saveProductKey,
	usage,
	type ProductModule,
} from '@magic-spells/kit';

import {
	loadProducts,
	noMoreArgs,
	rejectWorkspace,
	storeLabel,
	takeSwitch,
	takeValue,
	wantsHelp,
	type Shell,
} from '../shell.js';

const LOGIN_HELP = `Usage: magic login --product-key [<product>]

Stores a product key (from a hidden prompt, or stdin when piped) in the OS keychain,
or a 0600 file where there is none. Without <product>, the key's prefix picks it.
Account sign-in (\`magic login\` alone) arrives in a later release.
`;

const LOGOUT_HELP = `Usage: magic logout [--product <product>]

Forgets the stored key of every product, or of one.
`;

export async function login(shell: Shell, argv: string[]): Promise<number> {
	const args = [...argv];
	if (wantsHelp(args)) {
		shell.io.err(LOGIN_HELP);
		return 0;
	}
	rejectWorkspace('login', shell.opts);
	if (!takeSwitch(args, 'product-key')) {
		throw usage(
			'Account login is not available yet.',
			'Run `magic login --product-key [<product>]` to store a product key.'
		);
	}
	const named = args.length > 0 && !args[0]!.startsWith('--') ? args.shift() : undefined;
	// Product ids never hold `_`; keys always do. Refuse a key typed as an argument
	// without echoing it (DOC-SECURITY).
	if (named?.includes('_')) {
		throw usage(
			'Keys are never read from arguments.',
			'Run `magic login --product-key` and paste the key at the prompt, or pipe it on stdin.'
		);
	}
	noMoreArgs('login', args);

	const products = await loadProducts(shell, named ? [named] : undefined);
	const label = named ? `${products[0]!.title} key` : 'Product key';
	const key = await shell.readSecret(`${label} (input hidden): `);
	if (!key) throw usage('No key given.', 'Paste the key at the prompt, or pipe it on stdin.');

	const product = named ? products[0]! : byPrefix(products, key);
	await saveProductKey(product, shell.store, key);
	const where = storeLabel(await shell.store.locate(manualItem(product.id)));
	envShadowNote(shell, product);
	render(
		{ product: product.id, key: maskKey(key.trim(), product.credential), stored_in: where },
		shell.opts,
		shell.io
	);
	return 0;
}

export async function logout(shell: Shell, argv: string[]): Promise<number> {
	const args = [...argv];
	if (wantsHelp(args)) {
		shell.io.err(LOGOUT_HELP);
		return 0;
	}
	rejectWorkspace('logout', shell.opts);
	const one = takeValue(args, 'product');
	noMoreArgs('logout', args);

	// Only the known `<product>:manual` items: listing the keychain is slow.
	const removed: string[] = [];
	for (const product of await loadProducts(shell, one ? [one] : undefined)) {
		if ((await shell.store.locate(manualItem(product.id))) !== null) removed.push(product.id);
		await forgetProductKey(product, shell.store);
		envShadowNote(shell, product);
	}
	render({ removed }, shell.opts, shell.io);
	return 0;
}

function byPrefix(products: ProductModule[], key: string): ProductModule {
	const match = products.find((p) => key.startsWith(p.credential));
	if (match) return match;
	throw usage(
		'The key prefix matches no product.',
		`Known prefixes: ${products.map((p) => `${p.credential} (${p.id})`).join(', ')}.`
	);
}

/** MAGIC_<PRODUCT>_KEY wins over the store; say so when it is set. */
function envShadowNote(shell: Shell, product: ProductModule): void {
	const envVar = productEnvVar(product.id, 'KEY');
	if (shell.env[envVar]?.trim() && !shell.opts.quiet) {
		shell.io.err(`note: ${envVar} is set and takes precedence over the stored key.\n`);
	}
}
