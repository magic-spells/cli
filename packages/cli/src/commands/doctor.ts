// `magic doctor [--json]` (FEATURE-WHOAMI-DOCTOR): the shell's own checks (Node,
// credential store, CLI version), Account (reachable, a grant stored), then per
// product: API reachable, key present and well-formed, and the product's own checks
// through the kit's runDoctorChecks. A product without a key fails only when nothing
// at all is signed in; otherwise it is a warning (no workspace there, or not used).
// Exit 0 when every check passes, else the class of the first failure.

import {
	contextFor,
	exitCodeFor,
	grantExpired,
	grantIdleExpiry,
	loadCliConfig,
	manualItem,
	readGrant,
	readIndex,
	jsonMode,
	maskKey,
	productConfig,
	productEnvVar,
	render,
	resolveCredential,
	runDoctorChecks,
	toMagicError,
	type DoctorResult,
	type MagicErrorCode,
	type ProductModule,
} from '@magic-spells/kit';

import { version } from '../version.js';
import { loadProducts, noMoreArgs, rejectWorkspace, wantsHelp, type Shell } from '../shell.js';

const REACH_TIMEOUT_MS = 5_000;

export async function doctor(shell: Shell, argv: string[]): Promise<number> {
	if (wantsHelp(argv)) {
		shell.io.err('Usage: magic doctor [--json]\n\nCheck the install, the keys and each product.\n');
		return 0;
	}
	rejectWorkspace('doctor', shell.opts);
	noMoreArgs('doctor', argv);

	const products = await loadProducts(shell);
	const checks: DoctorResult[] = [...shellChecks(shell), ...(await accountChecks(shell))];
	const signedIn = await anyCredential(shell, products);
	for (const product of products) checks.push(...(await productChecks(shell, product, signedIn)));

	const ok = checks.every((c) => c.ok);
	if (jsonMode(shell.opts, shell.io)) render({ ok, checks }, shell.opts, shell.io);
	else printHuman(shell, checks);

	const failed = checks.find((c) => !c.ok);
	return failed ? exitCodeFor((failed.code as MagicErrorCode | undefined) ?? 'unknown') : 0;
}

function shellChecks(shell: Shell): DoctorResult[] {
	const fileChosen = shell.env.MAGIC_CREDENTIALS_FILE === '1';
	return [
		{
			name: 'cli',
			product: 'magic',
			ok: true,
			detail: `magic ${version()}`,
			data: { version: version() },
		},
		// Information only: bin/magic.js exits before this runs on Node < 24.
		{ name: 'node', product: 'magic', ok: true, detail: `Node ${process.versions.node}` },
		shell.store.backend === 'keyring'
			? { name: 'credential store', product: 'magic', ok: true, detail: 'OS keychain' }
			: {
					name: 'credential store',
					product: 'magic',
					ok: true,
					...(fileChosen ? {} : { warn: true }),
					detail: fileChosen
						? 'file (MAGIC_CREDENTIALS_FILE=1), mode 0600'
						: 'file, mode 0600 — no OS keychain on this machine',
				},
	];
}

/** Account reachable (a failure only when a grant depends on it) and the stored grant. */
async function accountChecks(shell: Shell): Promise<DoctorResult[]> {
	const grant = await readGrant(shell.store);
	let accountUrl: string;
	try {
		accountUrl = loadCliConfig({
			products: [],
			env: shell.env,
			file: shell.readConfig(),
		}).accountUrl;
	} catch (err) {
		const e = toMagicError(err);
		return [{ name: 'account', product: 'account', ok: false, code: e.code, detail: e.message }];
	}
	const results: DoctorResult[] = [];
	try {
		const res = await fetch(accountUrl, {
			method: 'HEAD',
			signal: AbortSignal.timeout(REACH_TIMEOUT_MS),
		});
		results.push({
			name: 'account',
			product: 'account',
			ok: true,
			detail: `${accountUrl} answers (HTTP ${res.status})`,
		});
	} catch (err) {
		const e = toMagicError(networkish(err), {
			product: 'account',
			networkHint: 'Check MAGIC_ACCOUNT_URL and your network connection.',
		});
		const detail = e.hint ? `${e.message} — ${e.hint}` : e.message;
		results.push(
			grant
				? { name: 'account', product: 'account', ok: false, code: e.code, detail }
				: { name: 'account', product: 'account', ok: true, warn: true, detail }
		);
	}
	if (!grant) {
		results.push({
			name: 'account grant',
			product: 'account',
			ok: true,
			warn: true,
			detail: 'Not signed in (run `magic login`); product keys only.',
		});
	} else if (grantExpired(grant)) {
		results.push({
			name: 'account grant',
			product: 'account',
			ok: false,
			code: 'not_logged_in',
			detail: 'Your sign-in has ended — run `magic login`.',
		});
	} else {
		const who = grant.user ? `${grant.user.display_name} <${grant.user.email}>` : 'signed in';
		results.push({
			name: 'account grant',
			product: 'account',
			ok: true,
			detail: `${who} until ${grant.expires_at.slice(0, 10)} (idle sign-out after ${grantIdleExpiry(grant).slice(0, 10)})`,
			data: { user: grant.user ?? null, expires_at: grant.expires_at },
		});
	}
	return results;
}

/** Any sign-in or product key at all: then a product without one is a warning. */
async function anyCredential(shell: Shell, products: ProductModule[]): Promise<boolean> {
	if (await readGrant(shell.store)) return true;
	if (Object.keys(await readIndex(shell.store)).length > 0) return true;
	for (const p of products) {
		if (shell.env[productEnvVar(p.id, 'KEY')]?.trim()) return true;
		if ((await shell.store.locate(manualItem(p.id))) !== null) return true;
	}
	return false;
}

async function productChecks(
	shell: Shell,
	product: ProductModule,
	signedIn: boolean
): Promise<DoctorResult[]> {
	const id = product.id;
	const networkHint = `Check ${productEnvVar(id, 'URL')} and your network connection.`;
	const fail = (name: string, err: unknown): DoctorResult => {
		const e = toMagicError(err, { product: id, networkHint });
		return {
			name,
			product: id,
			ok: false,
			code: e.code,
			detail: e.hint ? `${e.message} — ${e.hint}` : e.message,
		};
	};

	let config;
	try {
		config = productConfig(product, shell);
	} catch (err) {
		return [fail(`${id} config`, err)];
	}
	const apiUrl = config.products[id]!.apiUrl;
	const results: DoctorResult[] = [];

	try {
		const res = await fetch(apiUrl, {
			method: 'HEAD',
			signal: AbortSignal.timeout(REACH_TIMEOUT_MS),
		});
		results.push({
			name: `${id} api`,
			product: id,
			ok: true,
			detail: `${apiUrl} answers (HTTP ${res.status})`,
		});
	} catch (err) {
		results.push(fail(`${id} api`, networkish(err)));
	}

	let session;
	try {
		const workspace = config.defaultWorkspace[id];
		session = await resolveCredential(product, {
			env: shell.env,
			store: shell.store,
			...(workspace ? { workspace } : {}),
		});
	} catch (err) {
		const failed = fail(`${id} key`, err);
		// Several workspaces with no default, or no key while signed in elsewhere: worth
		// knowing, not broken.
		const soft = failed.code === 'usage' || (failed.code === 'not_logged_in' && signedIn);
		results.push(soft ? { ...failed, ok: true, warn: true } : failed);
		return results;
	}
	results.push({
		name: `${id} key`,
		product: id,
		ok: true,
		detail: `${maskKey(session.key, product.credential)} from ${keySource(session.source)}${session.workspace ? ` (workspace ${session.workspace.handle})` : ''}`,
	});
	results.push(
		...(await runDoctorChecks(product.doctor ?? [], contextFor(product, config, session), id))
	);
	return results;
}

function keySource(source: 'account' | 'manual' | 'env'): string {
	return source === 'env'
		? 'the environment'
		: source === 'account'
			? 'your sign-in'
			: 'a pasted key';
}

/** fetch rejects with a bare "fetch failed"; the cause says why. */
function networkish(err: unknown): unknown {
	if (err instanceof Error && err.cause instanceof Error) {
		return new Error(`${err.message}: ${err.cause.message}`);
	}
	return err;
}

function printHuman(shell: Shell, checks: DoctorResult[]): void {
	const width = Math.max(...checks.map((c) => c.name.length));
	const lines = checks.map((c) => {
		const mark = !c.ok ? 'FAIL' : c.warn ? 'warn' : 'ok  ';
		return `${mark}  ${c.name.padEnd(width)}  ${c.detail}`;
	});
	shell.io.out(`${lines.join('\n')}\n`);
}
