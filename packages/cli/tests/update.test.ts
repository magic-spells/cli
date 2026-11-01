// `magic update` and the update notice (COMPONENT-UPGRADE) against a fake npm
// registry on 127.0.0.1. The npm install is stubbed; never the real registry.

import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { installMethod } from '@magic-spells/kit';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { serveMcp } from '../src/commands/mcp.js';
import type { UpdateDeps } from '../src/commands/update.js';
import { version } from '../src/version.js';
import { DEAD_URL, magic } from './helpers.js';

// `magic mcp` without a stdio server: the shell's real mcp dispatch, a stubbed start.
vi.mock('../src/commands/mcp.js', () => ({ serveMcp: vi.fn(async () => 0) }));

const CURRENT = version();
const NEWER = '99.0.0';
const GLOBAL_BIN = '/usr/local/lib/node_modules/magic-spells/bin/magic.js';
const NPX_BIN = '/home/ann/.npm/_npx/0a1b2c/node_modules/magic-spells/bin/magic.js';
const CHECKOUT_BIN = '/home/ann/code/cli/packages/cli/bin/magic.js';
const DAY = 24 * 60 * 60 * 1000;

/** The fake registry: counts requests and answers `answer`. */
const registry = { url: '', hits: 0, answer: { version: NEWER } as unknown };
let server: Server;
beforeAll(async () => {
	server = createServer((req, res) => {
		registry.hits++;
		res.writeHead(req.url === '/magic-spells/latest' ? 200 : 404, {
			'content-type': 'application/json',
		});
		res.end(JSON.stringify(registry.answer));
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	registry.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/magic-spells/latest`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
	registry.hits = 0;
	registry.answer = { version: NEWER };
});

/** `magic update …` with a stubbed npm install that records its spec. */
async function runUpdate(argv: string[], binPath: string, opts: { tty?: boolean } = {}) {
	const installs: string[] = [];
	const update: UpdateDeps = {
		registryUrl: registry.url,
		binPath,
		npmInstall: async (spec) => {
			installs.push(spec);
			return 0;
		},
	};
	const r = await magic(['update', ...argv], { update, tty: opts.tty ?? true });
	return { ...r, installs };
}

describe('magic update', () => {
	it('already current: says so and installs nothing', async () => {
		registry.answer = { version: CURRENT };
		const r = await runUpdate([], GLOBAL_BIN);
		expect(r.code).toBe(0);
		expect(r.stdout).toBe(`magic ${CURRENT} is the latest version.\n`);
		expect(r.installs).toEqual([]);
	});

	it('newer under a global npm install: runs npm install -g at that version', async () => {
		const r = await runUpdate([], GLOBAL_BIN);
		expect(r.code).toBe(0);
		expect(r.installs).toEqual([`magic-spells@${NEWER}`]);
		expect(r.stdout).toBe(`magic ${NEWER} installed.\n`);
	});

	it('a Windows global install is npm-global too', async () => {
		const r = await runUpdate(
			[],
			'C:\\Users\\ann\\AppData\\Roaming\\npm\\node_modules\\magic-spells\\bin\\magic.js'
		);
		expect(r.installs).toEqual([`magic-spells@${NEWER}`]);
	});

	it('a failed npm install is an error with the manual command', async () => {
		const r = await magic(['update', '--no-color'], {
			tty: true,
			update: { registryUrl: registry.url, binPath: GLOBAL_BIN, npmInstall: async () => 1 },
		});
		expect(r.code).toBe(1);
		expect(r.stderr).toContain('npm install -g magic-spells@latest');
	});

	it('install methods, including the Windows global roots and a project-local install', () => {
		const cases: [string, string][] = [
			[GLOBAL_BIN, 'npm-global'],
			[
				'C:\\Users\\ann\\AppData\\Roaming\\npm\\node_modules\\magic-spells\\bin\\magic.js',
				'npm-global',
			],
			['C:\\Program Files\\nodejs\\node_modules\\magic-spells\\bin\\magic.js', 'npm-global'],
			[
				'C:\\Users\\ann\\AppData\\Roaming\\nvm\\v24.1.0\\node_modules\\magic-spells\\bin\\magic.js',
				'npm-global',
			],
			[
				'C:\\Users\\ann\\AppData\\Local\\Volta\\tools\\image\\packages\\magic-spells\\node_modules\\magic-spells\\bin\\magic.js',
				'npm-global',
			],
			['C:\\proj\\node_modules\\magic-spells\\bin\\magic.js', 'other'],
			['/home/ann/proj/node_modules/magic-spells/bin/magic.js', 'other'],
			[NPX_BIN, 'npx'],
			[
				'C:\\Users\\ann\\AppData\\Local\\npm-cache\\_npx\\0a1b\\node_modules\\magic-spells\\bin\\magic.js',
				'npx',
			],
			[CHECKOUT_BIN, 'other'],
		];
		for (const [path, method] of cases) expect([path, installMethod(path)]).toEqual([path, method]);
	});

	it('a project-local install on Windows prints the command instead of installing', async () => {
		const r = await runUpdate([], 'C:\\proj\\node_modules\\magic-spells\\bin\\magic.js');
		expect(r.installs).toEqual([]);
		expect(r.stdout).toContain('npm install -g magic-spells@latest');
	});

	it('through npx: nothing to update', async () => {
		const r = await runUpdate([], NPX_BIN);
		expect(r.code).toBe(0);
		expect(r.stdout).toContain("You're running magic through npx");
		expect(r.installs).toEqual([]);
	});

	it('anything else: prints where it runs from and the install command', async () => {
		const r = await runUpdate([], CHECKOUT_BIN);
		expect(r.code).toBe(0);
		expect(r.stdout).toContain(CHECKOUT_BIN);
		expect(r.stdout).toContain('npm install -g magic-spells@latest');
		expect(r.installs).toEqual([]);
	});

	it('--check only reports', async () => {
		const r = await runUpdate(['--check'], GLOBAL_BIN);
		expect(r.code).toBe(0);
		expect(r.stdout).toBe(`magic ${NEWER} is available (you have ${CURRENT}).\n`);
		expect(r.installs).toEqual([]);
	});

	it('--json gives {current, latest, upToDate, method} and installs nothing', async () => {
		const r = await runUpdate(['--json'], NPX_BIN);
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout)).toEqual({
			current: CURRENT,
			latest: NEWER,
			upToDate: false,
			method: 'npx',
		});
		expect(r.installs).toEqual([]);
	});

	it('registry down: network envelope, exit 10', async () => {
		const r = await magic(['update', '--json'], {
			update: { registryUrl: DEAD_URL, binPath: GLOBAL_BIN },
		});
		expect(r.code).toBe(10);
		expect(JSON.parse(r.stderr).error).toMatchObject({
			code: 'network',
			hint: 'Check your connection, or run npm install -g magic-spells@latest.',
		});
	});

	it('never hands npm a version the pattern refuses', async () => {
		registry.answer = { version: '99.0.0 && rm -rf ~' };
		const r = await runUpdate([], GLOBAL_BIN);
		expect(r.code).toBe(10);
		expect(r.installs).toEqual([]);
	});

	it('is listed once in help as update', async () => {
		const r = await magic(['--help']);
		expect(r.stderr).toMatch(/^ {2}update {2,}/m);
	});
});

describe('the update notice', () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'magic-update-'));
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	const configPath = (): string => join(dir, 'magic', 'config.json');
	const writeConfig = (data: unknown): void => {
		mkdirSync(join(dir, 'magic'), { recursive: true });
		writeFileSync(configPath(), JSON.stringify(data));
	};
	const readConfig = (): Record<string, unknown> =>
		JSON.parse(readFileSync(configPath(), 'utf8')) as Record<string, unknown>;
	const notice = `A newer magic is available: ${NEWER} (you have ${CURRENT}). Run \`magic update\`.`;

	/** `magic <argv>` on two terminals, waiting for any background check. */
	async function run(
		argv: string[],
		opts: { env?: NodeJS.ProcessEnv; tty?: boolean; stderrIsTTY?: boolean; now?: number } = {}
	) {
		const checks: Promise<void>[] = [];
		const r = await magic(argv, {
			tty: opts.tty ?? true,
			stderrIsTTY: opts.stderrIsTTY ?? true,
			env: { XDG_CONFIG_HOME: dir, ...opts.env },
			update: {
				registryUrl: registry.url,
				...(opts.now !== undefined ? { now: () => opts.now! } : {}),
				onBackgroundCheck: (p) => void checks.push(p),
			},
		});
		await Promise.all(checks);
		return r;
	}

	it('a fresh cache with a newer version: one stderr line, no registry request', async () => {
		writeConfig({ updateCheck: { checkedAt: new Date().toISOString(), latest: NEWER } });
		const r = await run(['whoami']);
		expect(r.stderr.split(notice).length - 1).toBe(1);
		expect(r.stderr.trimEnd().endsWith(notice)).toBe(true);
		expect(registry.hits).toBe(0);
	});

	it('no cache: no notice yet, one request, cached; the next run shows it without a request', async () => {
		writeConfig({ defaultWorkspace: { pyramid: 'acme' } });
		const first = await run(['whoami']);
		expect(first.stderr).not.toContain('A newer magic');
		expect(registry.hits).toBe(1);
		expect(readConfig()).toMatchObject({
			defaultWorkspace: { pyramid: 'acme' },
			updateCheck: { latest: NEWER },
		});

		const second = await run(['whoami']);
		expect(second.stderr).toContain(notice);
		expect(registry.hits).toBe(1);
	});

	it('a cache a day old is refreshed', async () => {
		const old = new Date(Date.now() - DAY - 1000).toISOString();
		writeConfig({ updateCheck: { checkedAt: old, latest: CURRENT } });
		const r = await run(['whoami']);
		expect(r.stderr).not.toContain('A newer magic');
		expect(registry.hits).toBe(1);
		expect(readConfig().updateCheck).toMatchObject({ latest: NEWER });
	});

	it('within 24 h of the last check, no request', async () => {
		const checkedAt = Date.now() - DAY + 60_000;
		writeConfig({ updateCheck: { checkedAt: new Date(checkedAt).toISOString(), latest: CURRENT } });
		await run(['whoami']);
		expect(registry.hits).toBe(0);
	});

	it('a config.json that does not parse is never replaced', async () => {
		mkdirSync(join(dir, 'magic'), { recursive: true });
		writeFileSync(configPath(), '{ "accountUrl": "https://example.test", }');
		await run(['whoami']);
		expect(registry.hits).toBe(1);
		expect(readFileSync(configPath(), 'utf8')).toBe('{ "accountUrl": "https://example.test", }');
	});

	it('registry failures are silent', async () => {
		const r = await magic(['whoami'], {
			tty: true,
			stderrIsTTY: true,
			env: { XDG_CONFIG_HOME: dir },
			update: { registryUrl: DEAD_URL, onBackgroundCheck: (p) => void p },
		});
		expect(r.stderr).not.toContain('registry');
	});

	describe('suppressed', () => {
		beforeEach(() =>
			writeConfig({ updateCheck: { checkedAt: new Date(0).toISOString(), latest: NEWER } })
		);
		const cases: [string, string[], Parameters<typeof run>[1]][] = [
			['MAGIC_NO_UPDATE_CHECK=1', ['whoami'], { env: { MAGIC_NO_UPDATE_CHECK: '1' } }],
			['CI', ['whoami'], { env: { CI: 'true' } }],
			['--json', ['whoami', '--json'], {}],
			['--quiet', ['whoami', '--quiet'], {}],
			['a non-TTY stderr', ['whoami'], { stderrIsTTY: false }],
			['piped stdout', ['whoami'], { tty: false }],
			['magic update', ['update', '--check'], {}],
			['--help', ['whoami', '--help'], {}],
			['--version', ['--version'], {}],
		];
		it('magic mcp (the real dispatch; the server start is stubbed)', async () => {
			vi.mocked(serveMcp).mockClear();
			const r = await run(['mcp']);
			expect(vi.mocked(serveMcp)).toHaveBeenCalledTimes(1);
			expect(r.stderr).toBe('');
			expect(r.stdout).toBe('');
			expect(registry.hits).toBe(0);
		});

		for (const [name, argv, opts] of cases) {
			it(name, async () => {
				const r = await run(argv, opts);
				expect(r.stderr).not.toContain('A newer magic');
				if (argv[0] !== 'update') expect(registry.hits).toBe(0);
			});
		}
	});
});
