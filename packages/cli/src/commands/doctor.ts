// `magic doctor [--json]` (FEATURE-WHOAMI-DOCTOR, R0): the shell's own checks (Node,
// credential store, CLI version), then per product: API reachable, key present and
// well-formed, and the product's own checks through the kit's runDoctorChecks.
// Exit 0 when every check passes, else the class of the first failure.

import {
	contextFor,
	exitCodeFor,
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

	const checks: DoctorResult[] = [...shellChecks(shell)];
	for (const product of await loadProducts(shell))
		checks.push(...(await productChecks(shell, product)));

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

async function productChecks(shell: Shell, product: ProductModule): Promise<DoctorResult[]> {
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
		session = await resolveCredential(product, { env: shell.env, store: shell.store });
	} catch (err) {
		results.push(fail(`${id} key`, err));
		return results;
	}
	results.push({
		name: `${id} key`,
		product: id,
		ok: true,
		detail: `${maskKey(session.key, product.credential)} from ${session.source === 'env' ? 'the environment' : 'the store'}`,
	});
	results.push(
		...(await runDoctorChecks(product.doctor ?? [], contextFor(product, config, session), id))
	);
	return results;
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
