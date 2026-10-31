// runProductCli end to end against a demo product: dispatch, derivation, gates,
// credentials, render and exit codes (FLOW-RUN-OPERATION).

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { runProductCli } from '../src/cli.js';
import { manualItem } from '../src/credentials.js';
import { captureIO, DEMO_KEY, demoCalls, demoProduct, memoryStore } from './helpers.js';

const env = { MAGIC_DEMO_KEY: DEMO_KEY };

async function run(
	argv: string[],
	opts: { env?: NodeJS.ProcessEnv; tty?: boolean; store?: ReturnType<typeof memoryStore> } = {}
) {
	const io = captureIO(opts.tty ?? false);
	const code = await runProductCli(demoProduct, argv, {
		env: opts.env ?? env,
		store: opts.store ?? memoryStore(),
		io,
		readConfig: () => null,
	});
	return { code, ...io };
}

beforeEach(() => {
	demoCalls().length = 0;
});

describe('help and dispatch', () => {
	it('no args and --help print the derived tree to stderr, exit 0', async () => {
		for (const argv of [[], ['--help'], ['help']]) {
			const r = await run(argv);
			expect(r.code).toBe(0);
			expect(r.stdout).toBe('');
			expect(r.stderr).toContain('widget list (ls)');
			expect(r.stderr).toContain('widget move <widget>');
			expect(r.stderr).toContain('[destructive]');
		}
	});

	it('an unknown command is a usage error, exit 2', async () => {
		const r = await run(['widget', 'bogus']);
		expect(r.code).toBe(2);
		// Usage errors belong to the shell.
		expect(JSON.parse(r.stderr).error).toMatchObject({ code: 'usage', product: 'magic' });
	});

	it('runs an operation and prints JSON to a non-TTY stdout', async () => {
		const r = await run(['widget', 'move', 'W-1', '--status', 'Done', '--label', 'a,b']);
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout).input).toEqual({
			widget: 'W-1',
			status: 'Done',
			labels: ['a', 'b'],
		});
	});

	it('applies product global flags as defaults for matching inputs', async () => {
		await run(['--project', 'web', 'widget', 'move', 'W-1']);
		expect(demoCalls()[0]?.input).toMatchObject({ project: 'web' });
	});

	it('coerces numbers and rejects bad input as usage (exit 2)', async () => {
		await run(['widget', 'list', '--limit', '5']);
		expect(demoCalls()[0]?.input).toMatchObject({ limit: 5 });
		const bad = await run(['widget', 'list', '--limit', 'many']);
		expect(bad.code).toBe(2);
	});

	it('route switches hand off to another operation', async () => {
		await run(['widget', 'list', '--mine', '--limit', '2']);
		expect(demoCalls()[0]).toEqual({ op: 'mine', input: { limit: 2 } });
	});

	it('preset switches set input values', async () => {
		await run(['widget', 'archive', 'W-1']);
		await run(['widget', 'archive', 'W-1', '--unarchive']);
		expect(demoCalls().map((c) => c.input)).toEqual([
			{ widget: 'W-1', archived: true },
			{ widget: 'W-1', archived: false },
		]);
	});

	it('--file loads a JSON array (or { key: [...] }) into the declared input', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'kit-cli-'));
		const a = join(dir, 'a.json');
		const b = join(dir, 'b.json');
		writeFileSync(a, JSON.stringify([{ title: 'x' }]));
		writeFileSync(b, JSON.stringify({ rows: [{ title: 'y' }] }));
		await run(['widget', 'bulk', '--file', a]);
		await run(['widget', 'bulk', '--file', b]);
		expect(demoCalls().map((c) => c.input)).toEqual([
			{ rows: [{ title: 'x' }] },
			{ rows: [{ title: 'y' }] },
		]);
		expect((await run(['widget', 'bulk', '--file', join(dir, 'missing.json')])).code).toBe(2);
	});
});

describe('render', () => {
	it('a TTY gets a table and the cursor hint on stderr', async () => {
		const r = await run(['widget', 'list'], { tty: true });
		expect(r.stdout).toMatch(/^id\s+name\s*\nw1\s+One\s*\n$/);
		expect(r.stderr).toContain('more: --cursor c2');
	});

	it('--json wins on a TTY', async () => {
		const r = await run(['widget', 'list', '--json'], { tty: true });
		expect(JSON.parse(r.stdout).next_cursor).toBe('c2');
	});

	it('--quiet drops the cursor hint', async () => {
		const r = await run(['widget', 'list', '-q'], { tty: true });
		expect(r.stderr).toBe('');
	});
});

describe('destructive gate (DECISION-OPERATION-CONTRACT 4)', () => {
	it('without --yes: usage error, exit 2, nothing runs', async () => {
		const r = await run(['widget', 'delete', 'W-1'], {
			env: { ...env, MAGIC_ALLOW_DESTRUCTIVE: '1' },
		});
		expect(r.code).toBe(2);
		expect(demoCalls()).toEqual([]);
	});

	it('--yes without MAGIC_ALLOW_DESTRUCTIVE: destructive_action_disabled, exit 8', async () => {
		const r = await run(['widget', 'delete', 'W-1', '--yes']);
		expect(r.code).toBe(8);
		expect(JSON.parse(r.stderr).error.hint).toMatch(/MAGIC_ALLOW_DESTRUCTIVE=1/);
		expect(demoCalls()).toEqual([]);
	});

	it('both: runs', async () => {
		const r = await run(['widget', 'delete', 'W-1', '-y'], {
			env: { ...env, MAGIC_ALLOW_DESTRUCTIVE: '1' },
		});
		expect(r.code).toBe(0);
		expect(demoCalls()[0]?.op).toBe('delete');
	});
});

describe('credentials and config', () => {
	it('no key anywhere: not_logged_in, exit 3, with the env var in the hint', async () => {
		const r = await run(['whoami'], { env: {} });
		expect(r.code).toBe(3);
		const e = JSON.parse(r.stderr).error;
		expect(e.code).toBe('not_logged_in');
		expect(e.hint).toContain('MAGIC_DEMO_KEY');
	});

	it('a stored manual key is used when the env has none', async () => {
		const store = memoryStore({
			[manualItem('demo')]: JSON.stringify({ key: DEMO_KEY, source: 'manual' }),
		});
		const r = await run(['whoami'], { env: {}, store });
		expect(JSON.parse(r.stdout).key_tail).toBe('alue');
	});

	it('a wrong prefix is auth_invalid and never echoes the secret', async () => {
		const r = await run(['whoami'], { env: { MAGIC_DEMO_KEY: 'sk_live_TOPSECRET' } });
		expect(r.code).toBe(3);
		expect(r.stderr).not.toContain('TOPSECRET');
	});

	it('MAGIC_<PRODUCT>_URL overrides the default API URL', async () => {
		const r = await run(['whoami'], {
			env: { ...env, MAGIC_DEMO_URL: 'https://staging.example/' },
		});
		expect(JSON.parse(r.stdout).url).toBe('https://staging.example');
	});

	it('requiresSession: false runs without a key', async () => {
		const r = await run(['local', 'check'], { env: {} });
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout).session).toBeNull();
	});

	it('human errors read `error [code]: message` with the hint', async () => {
		const r = await run(['whoami'], { env: {}, tty: true });
		expect(r.stderr).toMatch(/^error \[not_logged_in\]: No Demo key found\.\n  hint: /);
	});
});
