// `magic login` and `magic logout` (COMPONENT-LOGIN, FEATURE-DEVICE-LOGIN).
//
// login: sign in to Account, through the loopback browser flow when a browser is local
// (FLOW-LOGIN-LOOPBACK) or the device flow otherwise or with --device
// (FLOW-LOGIN-DEVICE); store the grant as `account:grant`; then mint a session in
// every product that declares a sessions route, in parallel (FLOW-PRODUCT-SESSION-MINT).
// A product that fails is reported and skipped; login still succeeds. Replacing an
// existing sign-in asks first (--yes skips) and retires the old grant and its product
// keys only after the new sign-in works.
//
// `magic login --product-key [<product>]` stores a pasted key (CI): from a hidden
// prompt or piped stdin, never from argv (DOC-SECURITY).
//
// logout: DELETE each product's sessions with its own key, revoke the grant, delete
// every store item; --product <p> for one product (the grant stays).

import {
	AccountClient,
	GRANT_ITEM,
	MagicError,
	authorizeUrl,
	contextFor,
	createPkce,
	forgetProductKey,
	forgetSessions,
	grantExpired,
	grantFromToken,
	isMagicError,
	jsonMode,
	loadCliConfig,
	manualItem,
	maskKey,
	mintSessions,
	productConfig,
	productEnvVar,
	productSessions,
	randomState,
	readField,
	readGrant,
	readStr,
	rec,
	remintFor,
	render,
	revokeSessions,
	runWithRemint,
	saveGrant,
	saveProductKey,
	startLoopback,
	storeSessions,
	toMagicError,
	usage,
	waitForDevice,
	type AccountToken,
	type CliConfig,
	type GrantUser,
	type MagicErrorShape,
	type ProductModule,
	type ProductSession,
	type ProductSessionIndex,
	type StoredGrant,
} from '@magic-spells/kit';

import { browserIsLocal } from '../browser.js';
import {
	cancelled,
	chooseEntries,
	loadProducts,
	noMoreArgs,
	rejectWorkspace,
	storeLabel,
	takeSwitch,
	takeValue,
	wantsHelp,
	type Shell,
} from '../shell.js';

const LOGIN_HELP = `Usage: magic login [--device] [--product <product>] [--yes]
       magic login --product-key [<product>]

Signs in to your Magic Spells account, then mints a short-lived key in each product
for every workspace you belong to. Opens your browser when one is on this machine;
otherwise (or with --device) prints a code to enter on any device.

  --device             sign in with a code instead of a browser on this machine
  --product <product>  mint (or re-mint) one product's keys
  --yes, -y            replace an existing sign-in without asking
  --product-key        store a pasted product key instead (from a hidden prompt or
                       stdin; for CI). Without <product>, the key's prefix picks it.
`;

const LOGOUT_HELP = `Usage: magic logout [--product <product>]

Revokes your product keys and your sign-in, and deletes every stored credential.
With --product, only that product's keys (you stay signed in).
`;

// ============ login ============

export interface LoginResult {
	account: { user: GrantUser | null; expires_at: string; account_url: string };
	products: Record<
		string,
		{ workspaces: string[]; default: string | null } | { error: MagicErrorShape }
	>;
}

export async function login(shell: Shell, argv: string[]): Promise<number> {
	const args = [...argv];
	if (wantsHelp(args)) {
		shell.io.err(LOGIN_HELP);
		return 0;
	}
	rejectWorkspace('login', shell.opts);
	if (takeSwitch(args, 'product-key')) return productKeyLogin(shell, args);

	const device = takeSwitch(args, 'device');
	const only = takeValue(args, 'product');
	noMoreArgs('login', args);
	if (only) chooseEntries(shell, [only]); // unknown product: usage error

	const all = await loadProducts(shell);
	const targets = all.filter((p) => p.sessions && (!only || p.id === only));
	if (only && targets.length === 0) {
		throw usage(
			`${only} does not mint keys from your account.`,
			`Run \`magic login --product-key ${only}\` to store a key.`
		);
	}
	const config = loadCliConfig({
		products: all.map((p) => ({ id: p.id, apiUrl: p.apiUrl })),
		env: shell.env,
		file: shell.readConfig(),
	});

	const interrupt = interruptSignal(shell);
	try {
		const old = await readGrant(shell.store);
		const live = old && !grantExpired(old) ? old : null;
		let grant: StoredGrant;
		let previous: Previous | null = null;
		if (only && live) {
			grant = live;
		} else {
			if (live) await confirmReplace(shell, live);
			previous = old ? await snapshot(shell, all, old) : null;
			const token = await signIn(shell, config, device, interrupt.signal);
			grant = grantFromToken(token, config.accountUrl);
			await saveGrant(shell.store, grant);
		}

		const minted = await mintAll(shell, config, targets, grant, interrupt.signal);
		grant = await rememberUser(shell, config, minted, grant);
		if (previous) await retire(shell, config, previous, minted);

		const result = loginResult(grant, minted);
		report(shell, result);
		if (jsonMode(shell.opts, shell.io)) render(result, shell.opts, shell.io);
		return 0;
	} finally {
		interrupt.dispose();
	}
}

/** Ctrl-C ends the sign-in as auth_cancelled; nothing is stored before the grant. */
function interruptSignal(shell: Shell): { signal: AbortSignal; dispose: () => void } {
	if (shell.login.interrupt) return { signal: shell.login.interrupt, dispose: () => {} };
	const controller = new AbortController();
	const onSigint = (): void => controller.abort();
	process.once('SIGINT', onSigint);
	return { signal: controller.signal, dispose: () => process.off('SIGINT', onSigint) };
}

async function confirmReplace(shell: Shell, grant: StoredGrant): Promise<void> {
	if (shell.opts.yes) return;
	const who = grant.user ? `${grant.user.display_name} (${grant.user.email})` : 'another person';
	if (!shell.confirm) {
		throw usage(`Already logged in as ${who}.`, 'Re-run with --yes to replace that sign-in.');
	}
	if (!(await shell.confirm(`Already logged in as ${who}. Replace that sign-in? [y/N] `))) {
		throw cancelled();
	}
}

async function signIn(
	shell: Shell,
	config: CliConfig,
	forceDevice: boolean,
	signal: AbortSignal
): Promise<AccountToken> {
	const client = new AccountClient({
		accountUrl: config.accountUrl,
		clientId: config.accountClientId,
	});
	void client.clientId; // the placeholder check, before any browser opens
	const local = browserIsLocal(shell.env, shell.platform);
	return !forceDevice && local
		? loopbackSignIn(shell, client, signal)
		: deviceSignIn(shell, client, local, signal);
}

async function loopbackSignIn(
	shell: Shell,
	client: AccountClient,
	signal: AbortSignal
): Promise<AccountToken> {
	const pkce = createPkce();
	const state = randomState();
	const loopback = await startLoopback({
		state,
		signal,
		...(shell.login.loopbackTimeoutMs !== undefined
			? { timeoutMs: shell.login.loopbackTimeoutMs }
			: {}),
		exchange: (code, redirectUri, exchangeSignal) =>
			client.exchangeCode({ code, verifier: pkce.verifier, redirectUri, signal: exchangeSignal }),
	});
	const url = authorizeUrl({
		accountUrl: client.accountUrl,
		clientId: client.clientId,
		redirectUri: loopback.redirectUri,
		state,
		challenge: pkce.challenge,
	});
	if (await shell.openBrowser(url)) {
		note(shell, 'Opened your browser to sign in to Magic Spells. Waiting for you to finish…');
	} else {
		shell.io.err(`Open this page to sign in to Magic Spells:\n\n  ${url}\n\n`);
	}
	return loopback.result;
}

async function deviceSignIn(
	shell: Shell,
	client: AccountClient,
	browserLocal: boolean,
	signal: AbortSignal
): Promise<AccountToken> {
	const start = await client.startDevice(signal);
	const bold = (t: string): string => (shell.opts.color === false ? t : `\x1b[1m${t}\x1b[22m`);
	const big = start.user_code.split('').join(' ');
	// The code is the whole point of this flow: printed even with --quiet.
	shell.io.err(
		`To sign in, open this page on any device:\n\n  ${start.verification_uri}\n\n` +
			`and enter the code:\n\n      ${bold(big)}\n\n`
	);
	if (browserLocal && start.verification_uri_complete) {
		if (await shell.openBrowser(start.verification_uri_complete)) {
			note(shell, 'Opened your browser.');
		}
	}
	const countdown = shell.io.isTTY() && !shell.opts.quiet;
	if (!countdown) {
		note(shell, `Waiting for approval (the code expires in ${minutes(start.expires_in)})…`);
	}
	try {
		return await waitForDevice(client, start, {
			signal,
			...(shell.login.sleep ? { sleep: shell.login.sleep } : {}),
			...(shell.login.now ? { now: shell.login.now } : {}),
			...(countdown
				? { onTick: (s: number) => shell.io.err(`\rWaiting for approval… ${clock(s)} left `) }
				: {}),
		});
	} finally {
		if (countdown) shell.io.err('\r\x1b[K');
	}
}

interface Minted {
	product: ProductModule;
	entry?: ProductSessionIndex;
	sessions?: ProductSession[];
	error?: MagicError;
}

/** Mint every product in parallel, then store one product at a time (one index item). */
async function mintAll(
	shell: Shell,
	config: CliConfig,
	products: ProductModule[],
	grant: StoredGrant,
	signal: AbortSignal
): Promise<Minted[]> {
	const answers = await Promise.all(
		products.map(async (product) => {
			try {
				const res = await mintSessions(product, {
					apiUrl: config.products[product.id]!.apiUrl,
					grant: grant.access_token,
					signal,
				});
				return { product, res };
			} catch (err) {
				return { product, error: toMagicError(err, { product: product.id }) };
			}
		})
	);
	const out: Minted[] = [];
	for (const a of answers) {
		if (!a.res) {
			out.push({ product: a.product, error: a.error! });
		} else if (a.res.sessions.length === 0) {
			out.push({
				product: a.product,
				error: new MagicError('permission_denied', `You have no ${a.product.title} workspaces.`, {
					product: a.product.id,
					details: { reason: 'no_workspaces' },
				}),
			});
		} else {
			const entry = await storeSessions(shell.store, a.product.id, a.res);
			out.push({ product: a.product, entry, sessions: a.res.sessions });
		}
	}
	return out;
}

/**
 * The session answer carries no person, so the first minted product with a
 * `<id>.whoami` operation says who this is; the grant keeps it for whoami. The grant
 * is also marked used: the mint restarted Account's idle clock.
 */
async function rememberUser(
	shell: Shell,
	config: CliConfig,
	minted: Minted[],
	grant: StoredGrant
): Promise<StoredGrant> {
	let user = grant.user;
	for (const m of minted) {
		if (user || !m.sessions) continue;
		try {
			const op = (await m.product.load()).find((o) => o.name === `${m.product.id}.whoami`);
			if (!op) continue;
			const ctx = contextFor(m.product, config, m.sessions[0]!);
			const identity = await runWithRemint(
				op,
				op.input.parse({}),
				ctx,
				remintFor(m.product, shell.store)
			);
			const u = rec(readField(identity, 'user'));
			const email = readStr(u.email);
			if (email) {
				user = {
					id: readStr(u.id) ?? '',
					display_name: readStr(u.display_name) ?? readStr(u.name) ?? email,
					email,
				};
			}
		} catch {
			// Who-am-I is a nicety; the sign-in stands without it.
		}
	}
	const touched: StoredGrant = {
		...grant,
		...(user ? { user } : {}),
		...(minted.some((m) => m.sessions) ? { last_used_at: new Date().toISOString() } : {}),
	};
	await saveGrant(shell.store, touched);
	return touched;
}

/** What the old sign-in held, read before the new mint overwrites the items. */
interface Previous {
	grant: StoredGrant;
	sessions: { product: ProductModule; sessions: ProductSession[] }[];
}

async function snapshot(shell: Shell, all: ProductModule[], grant: StoredGrant): Promise<Previous> {
	const sessions = [];
	for (const product of all) {
		const s = await productSessions(shell.store, product.id);
		if (s.length > 0) sessions.push({ product, sessions: s });
	}
	return { grant, sessions };
}

/** After the new sign-in works: revoke the old product keys and grant, drop stale items. */
async function retire(
	shell: Shell,
	config: CliConfig,
	previous: Previous,
	minted: Minted[]
): Promise<void> {
	for (const { product, sessions } of previous.sessions) {
		await revokeProduct(product, sessions, config).catch(() => {});
		if (!minted.some((m) => m.product.id === product.id && m.sessions)) {
			await forgetSessions(shell.store, product.id);
		}
	}
	await new AccountClient({ accountUrl: previous.grant.account_url })
		.revoke(previous.grant.access_token)
		.catch(() => {});
}

function loginResult(grant: StoredGrant, minted: Minted[]): LoginResult {
	const products: LoginResult['products'] = {};
	for (const m of minted) {
		products[m.product.id] = m.entry
			? { workspaces: m.entry.workspaces.map((w) => w.handle), default: m.entry.default ?? null }
			: { error: m.error!.toJSON() };
	}
	return {
		account: {
			user: grant.user ?? null,
			expires_at: grant.expires_at,
			account_url: grant.account_url,
		},
		products,
	};
}

/** "Logged in as …" and one line per product, on stderr. */
function report(shell: Shell, result: LoginResult): void {
	if (shell.opts.quiet) return;
	const u = result.account.user;
	const lines = [u ? `Logged in as ${u.display_name} (${u.email}).` : 'Logged in.'];
	const width = Math.max(...Object.keys(result.products).map((id) => id.length));
	for (const [id, p] of Object.entries(result.products)) {
		let line: string;
		if ('error' in p) {
			line = `skipped: ${p.error.message}${p.error.hint ? ` ${p.error.hint}` : ''}`;
		} else {
			const n = p.workspaces.length;
			const which = `${n} workspace${n === 1 ? '' : 's'}: ${p.workspaces.join(', ')}`;
			line = p.default ? `${which} (default)` : `${which} (use --workspace to pick one)`;
		}
		lines.push(`  ${id.padEnd(width)}  ${line}`);
	}
	shell.io.err(`${lines.join('\n')}\n`);
}

function note(shell: Shell, line: string): void {
	if (!shell.opts.quiet) shell.io.err(`${line}\n`);
}

function minutes(seconds: number): string {
	const m = Math.round(seconds / 60);
	return m === 1 ? '1 minute' : `${m} minutes`;
}

function clock(seconds: number): string {
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// ============ login --product-key ============

async function productKeyLogin(shell: Shell, args: string[]): Promise<number> {
	// Product ids never hold `_`; keys always do. Refuse a key typed as any argument,
	// and never quote a leftover argument back (DOC-SECURITY).
	if (args.some((a) => a.includes('_'))) {
		throw usage(
			'Keys are never read from arguments.',
			'Run `magic login --product-key` and paste the key at the prompt, or pipe it on stdin.'
		);
	}
	const named = args.length > 0 && !args[0]!.startsWith('--') ? args.shift() : undefined;
	if (args.length > 0) {
		throw usage('login: unexpected arguments.', 'Usage: magic login --product-key [<product>]');
	}

	const products = await loadProducts(shell, named ? [named] : undefined);
	const label = named ? `${products[0]!.title} key` : 'Product key';
	const key = await shell.readSecret(`${label} (input hidden): `);
	if (!key) throw usage('No key given.', 'Paste the key at the prompt, or pipe it on stdin.');

	const product = named ? products[0]! : byPrefix(products, key);
	await saveProductKey(product, shell.store, key);
	const where = storeLabel(await shell.store.locate(manualItem(product.id)));
	envShadowNote(shell, product);
	render(
		{ product: product.id, key: maskKey(key, product.credential), stored_in: where },
		shell.opts,
		shell.io
	);
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

// ============ logout ============

export interface LogoutResult {
	/** Products whose stored credentials were deleted. */
	removed: string[];
	/** Products whose account keys were revoked server-side. */
	revoked: string[];
	/** The grant: revoked, revocation not offered by Account, failed, kept (--product), none. */
	account: 'revoked' | 'unsupported' | 'failed' | 'kept' | 'none';
	errors?: Record<string, MagicErrorShape>;
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

	const chosen = await loadProducts(shell, one ? [one] : undefined);
	const grant = await readGrant(shell.store);
	const result: LogoutResult = { removed: [], revoked: [], account: 'none' };
	const errors: Record<string, MagicErrorShape> = {};

	for (const product of chosen) {
		const sessions = await productSessions(shell.store, product.id);
		if (sessions.length > 0 && product.sessions) {
			try {
				await revokeProduct(product, sessions, productConfig(product, shell));
				result.revoked.push(product.id);
			} catch (err) {
				errors[product.id] = toMagicError(err, { product: product.id }).toJSON();
			}
		}
		// Local credentials go whatever the server said.
		const items = await forgetSessions(shell.store, product.id);
		const hadManual = (await shell.store.locate(manualItem(product.id))) !== null;
		await forgetProductKey(product, shell.store);
		if (items.length > 0 || hadManual) result.removed.push(product.id);
		envShadowNote(shell, product);
	}

	if (one) {
		result.account = grant ? 'kept' : 'none';
	} else if (grant) {
		try {
			result.account = await new AccountClient({ accountUrl: grant.account_url }).revoke(
				grant.access_token
			);
		} catch (err) {
			result.account = 'failed';
			errors.account = toMagicError(err, { product: 'account' }).toJSON();
		}
		await shell.store.delete(GRANT_ITEM);
	}
	if (Object.keys(errors).length > 0) result.errors = errors;

	if (!shell.opts.quiet) {
		if (result.account === 'unsupported') {
			shell.io.err(
				'note: Account does not offer grant revocation yet; the sign-in was forgotten here.\n'
			);
		}
		for (const [id, e] of Object.entries(errors)) {
			shell.io.err(`note: ${id}: could not revoke server-side (${e.message}); forgotten here.\n`);
		}
	}
	render(result, shell.opts, shell.io);
	return 0;
}

/**
 * DELETE the product's sessions route with one of its keys: that revokes every key
 * minted from the same grant. A key already dead (401) tries the next; when all are
 * dead there is nothing left to revoke.
 */
async function revokeProduct(
	product: ProductModule,
	sessions: ProductSession[],
	config: CliConfig
): Promise<void> {
	for (const s of sessions) {
		try {
			await revokeSessions(product, { apiUrl: config.products[product.id]!.apiUrl, key: s.key });
			return;
		} catch (err) {
			if (isMagicError(err) && (err.code === 'auth_invalid' || err.code === 'auth_expired')) {
				continue;
			}
			throw err;
		}
	}
}
