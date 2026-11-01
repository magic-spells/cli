// `magic update [--check] [--json]` (COMPONENT-UPGRADE): compare the running version
// with the npm registry's latest and, when newer, run the install for how this binary
// was installed (global npm: `npm install -g`; npx: nothing to do; anything else: print
// the command). --check and --json only report. Also the update notice: one stderr line
// from the check cached in config.json, refreshed at most once a day in the background.

import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';

import {
	UPDATE_REGISTRY_URL,
	VERSION_PATTERN,
	fetchLatestVersion,
	installMethod,
	isNewer,
	jsonMode,
	loadCliConfig,
	readConfigFile,
	readUpdateCheck,
	registryError,
	render,
	updateCheckDue,
	updateNotice,
	writeUpdateCheck,
	MagicError,
	type InstallMethod,
	type RenderIO,
} from '@magic-spells/kit';

import { version } from '../version.js';
import { noMoreArgs, rejectWorkspace, takeSwitch, wantsHelp, type Shell } from '../shell.js';

const LOOKUP_TIMEOUT_MS = 5_000;
const BACKGROUND_TIMEOUT_MS = 2_000;
const MANUAL = 'npm install -g magic-spells@latest';

/** Seams for tests; production uses the defaults. */
export interface UpdateDeps {
	registryUrl?: string;
	/** The realpath of the running bin. */
	binPath?: string;
	/** Run `npm install -g <spec>` with inherited stdio; resolves to its exit code. */
	npmInstall?: (spec: string) => Promise<number>;
	now?: () => number;
	/** Receives the background check so tests can wait for it. */
	onBackgroundCheck?: (done: Promise<void>) => void;
}

export interface UpdateReport {
	current: string;
	latest: string;
	upToDate: boolean;
	method: InstallMethod;
}

export async function update(shell: Shell, argv: string[]): Promise<number> {
	if (wantsHelp(argv)) {
		shell.io.err(
			'Usage: magic update [--check] [--json]\n\nUpdate magic to the latest version; --check only reports.\n'
		);
		return 0;
	}
	const args = [...argv];
	rejectWorkspace('update', shell.opts);
	const check = takeSwitch(args, 'check');
	noMoreArgs('update', args);

	const deps = shell.update;
	let latest: string;
	try {
		latest = await fetchLatestVersion(deps.registryUrl ?? UPDATE_REGISTRY_URL, {
			timeoutMs: LOOKUP_TIMEOUT_MS,
		});
	} catch (err) {
		throw registryError(err);
	}
	const binPath = deps.binPath ?? runningBin();
	const current = version();
	const report: UpdateReport = {
		current,
		latest,
		upToDate: !isNewer(latest, current),
		method: installMethod(binPath),
	};

	if (check || shell.opts.json) {
		if (jsonMode(shell.opts, shell.io)) render(report, shell.opts, shell.io);
		else shell.io.out(`${summary(report)}\n`);
		return 0;
	}
	if (report.upToDate) {
		shell.io.out(`${summary(report)}\n`);
		return 0;
	}
	if (report.method === 'npx') {
		shell.io.out(
			"You're running magic through npx, which already fetches the latest version; nothing to update.\n"
		);
		return 0;
	}
	if (report.method === 'other') {
		shell.io.out(
			`${summary(report)}\nThis magic runs from ${binPath}, not a global npm install. To install the latest globally:\n  ${MANUAL}\n`
		);
		return 0;
	}

	// Never hand npm a version the pattern does not allow (fetchLatestVersion checks too).
	if (!VERSION_PATTERN.test(latest)) throw registryError(new Error('Invalid version.'));
	const spec = `magic-spells@${latest}`;
	if (!shell.opts.quiet)
		shell.io.err(`Updating magic ${current} → ${latest}: npm install -g ${spec}\n`);
	const code = await (deps.npmInstall ?? npmInstall)(spec);
	if (code !== 0) {
		throw new MagicError('unknown', `npm install -g ${spec} failed (exit ${code}).`, {
			hint: `Run ${MANUAL} yourself to see why.`,
		});
	}
	shell.io.out(`magic ${latest} installed.\n`);
	return 0;
}

function summary(r: UpdateReport): string {
	return r.upToDate
		? `magic ${r.current} is the latest version.`
		: `magic ${r.latest} is available (you have ${r.current}).`;
}

function runningBin(): string {
	const bin = process.argv[1] ?? '';
	try {
		return realpathSync(bin);
	} catch {
		return bin;
	}
}

function npmInstall(spec: string): Promise<number> {
	const win = process.platform === 'win32';
	return new Promise((resolve, reject) => {
		const child = spawn(win ? 'npm.cmd' : 'npm', ['install', '-g', spec], {
			stdio: 'inherit',
			shell: win,
		});
		child.on('error', reject);
		child.on('exit', (code) => resolve(code ?? 1));
	});
}

export interface NoticeContext {
	cmd: string;
	argv: string[];
	io: RenderIO;
	env: NodeJS.ProcessEnv;
	stderrIsTTY: boolean;
	configPath: string;
	deps: UpdateDeps;
}

/** Never under these, nor --json, --quiet or --help: the MCP server's stdio is its own. */
const NO_NOTICE = new Set(['update', 'mcp']);

/**
 * Start the update notice for this run: reads the cached check now and, when it is a
 * day old, refreshes it in the background (2 s, unref'd, failures silent) while the
 * command runs. The returned function prints the notice after the command's output.
 */
export function startUpdateNotice(ctx: NoticeContext): () => void {
	const has = (...flags: string[]): boolean => flags.some((f) => ctx.argv.includes(f));
	if (NO_NOTICE.has(ctx.cmd) || has('--json', '--quiet', '-q', '--help', '-h')) return noop;
	if (!ctx.stderrIsTTY || !ctx.io.isTTY()) return noop;
	const file = readConfigFile(ctx.configPath);
	try {
		if (!loadCliConfig({ products: [], env: ctx.env, file }).updateCheck) return noop;
	} catch {
		return noop;
	}

	const cached = readUpdateCheck(file);
	const now = ctx.deps.now ?? Date.now;
	if (updateCheckDue(cached, now())) {
		const done = fetchLatestVersion(ctx.deps.registryUrl ?? UPDATE_REGISTRY_URL, {
			timeoutMs: BACKGROUND_TIMEOUT_MS,
			unref: true,
		})
			.then((latest) => {
				writeUpdateCheck(ctx.configPath, { checkedAt: new Date(now()).toISOString(), latest });
			})
			.catch(() => {
				// Silent: the notice is best-effort and never fails a command.
			});
		ctx.deps.onBackgroundCheck?.(done);
	}
	const line = cached ? updateNotice(version(), cached.latest) : null;
	return line ? () => ctx.io.err(`${line}\n`) : noop;
}

function noop(): void {}
