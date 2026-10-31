// `magic mcp` (FEATURE-MCP-AGGREGATOR): an MCP client harness in-process over an
// in-memory transport, and one full stdio session against the built binary whose
// stdout must be JSON-RPC only. A fake Pyramid API; never production.

import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMcp } from '../src/commands/mcp.js';
import { PRODUCTS, type ProductEntry } from '../src/products.js';
import type { Shell } from '../src/shell.js';
import { KEY, startFakeApi, type FakeApi } from './fake-api.js';
import { memoryStore } from './helpers.js';

let api: FakeApi;
beforeAll(async () => {
	api = await startFakeApi();
});
afterAll(() => api.close());

function shell(env: NodeJS.ProcessEnv, store = memoryStore()): Shell {
	return {
		io: { out: () => {}, err: () => {}, isTTY: () => false },
		env: { MAGIC_PYRAMID_URL: api.url, ...env },
		store,
		entries: PRODUCTS,
		opts: { json: false, yes: false, quiet: false },
		readConfig: () => null,
		readSecret: async () => '',
		openBrowser: async () => false,
		confirm: null,
		platform: process.platform,
		login: {},
	};
}

async function connect(s: Shell, argv: string[] = []) {
	const built = await buildMcp(s, argv, new AbortController().signal);
	const [a, b] = InMemoryTransport.createLinkedPair();
	const client = new Client({ name: 'harness', version: '0.0.0' });
	await Promise.all([built.server.connect(a), client.connect(b)]);
	return client;
}

const text = (r: unknown): string =>
	((r as { content: { text: string }[] }).content[0] ?? { text: '' }).text;

describe('magic mcp (in-process harness)', () => {
	it('lists the pyramid_* tools, resources and prompt, with the family instructions', async () => {
		const client = await connect(shell({ MAGIC_PYRAMID_KEY: KEY }));
		const { tools } = await client.listTools();
		expect(tools).toHaveLength(17);
		expect(tools.every((t) => t.name.startsWith('pyramid_'))).toBe(true);
		expect(tools.map((t) => t.name)).toContain('pyramid_task_list_mine');
		const { prompts } = await client.listPrompts();
		expect(prompts.map((p) => p.name)).toEqual(['pyramid_doctor']);
		const { resources } = await client.listResources();
		expect(resources.map((r) => r.uri).sort()).toEqual(['pyramid://me', 'pyramid://projects']);
		const instructions = client.getInstructions() ?? '';
		expect(instructions).toMatch(/^Magic MCP — /);
		expect(instructions).toMatch(/\n## Pyramid\n\nPyramid MCP v\d+\.\d+\.\d+ — /);
		await client.close();
	});

	it('a tool call runs against the API', async () => {
		const client = await connect(shell({ MAGIC_PYRAMID_KEY: KEY }));
		const r = await client.callTool({ name: 'pyramid_whoami', arguments: {} });
		expect(r.isError).toBeFalsy();
		expect(JSON.parse(text(r)).workspace).toMatchObject({ handle: 'acme' });
		await client.close();
	});

	it('no key: tools still listed, calls answer not_logged_in; store, replace and logout apply live', async () => {
		const store = memoryStore();
		const client = await connect(shell({}, store));
		expect((await client.listTools()).tools).toHaveLength(17);
		const before = await client.callTool({ name: 'pyramid_whoami', arguments: {} });
		expect(before.isError).toBe(true);
		expect(JSON.parse(text(before)).error).toMatchObject({
			code: 'not_logged_in',
			product: 'pyramid',
		});
		const resource = await client.readResource({ uri: 'pyramid://me' });
		expect(JSON.parse((resource.contents[0] as { text: string }).text).error.code).toBe(
			'not_logged_in'
		);
		const call = async () => {
			const r = await client.callTool({ name: 'pyramid_whoami', arguments: {} });
			return r.isError ? JSON.parse(text(r)).error.code : 'ok';
		};
		store.items['pyramid:manual'] = JSON.stringify({ key: KEY });
		expect(await call()).toBe('ok');
		// A replaced key is used on the next call (the fake API rejects this one).
		store.items['pyramid:manual'] = JSON.stringify({
			key: 'pyramid_ab23cd45_ffffffffffffffffffffffffffffffff',
		});
		expect(await call()).toBe('auth_invalid');
		// After logout the server is logged out too.
		delete store.items['pyramid:manual'];
		expect(await call()).toBe('not_logged_in');
		await client.close();
	});

	it('a product that throws in load() or mcp.register is left out with one stderr line', async () => {
		const broken = (id: string, where: 'load' | 'register'): ProductEntry => ({
			id,
			title: id,
			load: async () => ({
				id,
				title: id,
				credential: `${id.slice(0, 2)}k_`,
				apiUrl: 'http://127.0.0.1:1',
				client: () => ({}),
				load: async () => {
					if (where === 'load') throw new Error('load exploded');
					return [];
				},
				mcp: {
					instructions: () => `${id} rules`,
					register: () => {
						throw new Error('register exploded');
					},
				},
			}),
		});
		const lines: string[] = [];
		const s = {
			...shell({ MAGIC_PYRAMID_KEY: KEY }),
			entries: [...PRODUCTS, broken('aa', 'load'), broken('bb', 'register')],
			io: { out: () => {}, err: (t: string) => void lines.push(t), isTTY: () => false },
		};
		const built = await buildMcp(s, [], new AbortController().signal);
		expect(built.products.map((p) => p.module.id)).toEqual(['pyramid']);
		expect(lines).toEqual([
			'magic mcp: aa: left out (load exploded)\n',
			'magic mcp: bb: left out (register exploded)\n',
		]);
		const [a, b] = InMemoryTransport.createLinkedPair();
		const client = new Client({ name: 'harness', version: '0.0.0' });
		await Promise.all([built.server.connect(a), client.connect(b)]);
		expect((await client.listTools()).tools).toHaveLength(17);
		expect(client.getInstructions()).not.toContain('bb rules');
		await client.close();
	});

	it('--products filters, and an unknown product is a usage error', async () => {
		const client = await connect(shell({ MAGIC_PYRAMID_KEY: KEY }), ['--products', 'pyramid']);
		expect((await client.listTools()).tools).toHaveLength(17);
		await client.close();
		await expect(
			buildMcp(shell({}), ['--products', 'pyramid,nope'], new AbortController().signal)
		).rejects.toMatchObject({ code: 'usage' });
	});
});

// ============ stdio, against the built binary ============

const root = fileURLToPath(new URL('../../..', import.meta.url));
const bin = join(root, 'packages/cli/bin/magic.js');

describe('magic mcp over stdio', () => {
	beforeAll(() => {
		// The binary runs dist/; tsc -b is incremental, so this is cheap when built.
		execFileSync(
			process.execPath,
			[join(root, 'node_modules/typescript/bin/tsc'), '-b', 'packages/cli'],
			{
				cwd: root,
			}
		);
	}, 60_000);

	it('a full session writes only JSON-RPC to stdout and exits 0 when stdin closes', async () => {
		const child = spawn(process.execPath, [bin, 'mcp'], {
			env: {
				PATH: process.env.PATH,
				XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), 'magic-mcp-')),
				MAGIC_CREDENTIALS_FILE: '1',
				MAGIC_PYRAMID_KEY: KEY,
				MAGIC_PYRAMID_URL: api.url,
			},
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (d) => (stdout += d));
		child.stderr.on('data', (d) => (stderr += d));
		const send = (msg: object): void => void child.stdin.write(`${JSON.stringify(msg)}\n`);
		const waitFor = async (id: number): Promise<void> => {
			for (let i = 0; i < 200 && !stdout.includes(`"id":${id}`); i++) {
				await new Promise((r) => setTimeout(r, 25));
			}
		};

		send({
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: {
				protocolVersion: '2025-06-18',
				capabilities: {},
				clientInfo: { name: 'harness', version: '0' },
			},
		});
		await waitFor(1);
		send({ jsonrpc: '2.0', method: 'notifications/initialized' });
		send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
		await waitFor(2);
		send({
			jsonrpc: '2.0',
			id: 3,
			method: 'tools/call',
			params: { name: 'pyramid_whoami', arguments: {} },
		});
		await waitFor(3);
		const exited = new Promise<number | null>((resolve) => child.on('exit', resolve));
		child.stdin.end();
		expect(await exited).toBe(0);

		const messages = stdout
			.split('\n')
			.filter((l) => l.length > 0)
			.map((l) => JSON.parse(l) as { jsonrpc: string; id?: number; result?: any });
		expect(messages.every((m) => m.jsonrpc === '2.0')).toBe(true);
		const tools = messages.find((m) => m.id === 2)!.result.tools as { name: string }[];
		expect(tools.map((t) => t.name).every((n) => n.startsWith('pyramid_'))).toBe(true);
		expect(tools).toHaveLength(17);
		expect(messages.find((m) => m.id === 3)!.result.isError).toBeFalsy();
		expect(stderr).toContain('magic mcp: ready on stdio · pyramid (17 tools)');
	}, 20_000);

	it('reads a key piped on stdin for login --product-key (no prompt, no echo)', async () => {
		const home = mkdtempSync(join(tmpdir(), 'magic-login-'));
		const child = spawn(process.execPath, [bin, 'login', '--product-key'], {
			env: { PATH: process.env.PATH, XDG_CONFIG_HOME: home, MAGIC_CREDENTIALS_FILE: '1' },
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		let out = '';
		let err = '';
		child.stdout.on('data', (d) => (out += d));
		child.stderr.on('data', (d) => (err += d));
		child.stdin.end(`${KEY}\n`);
		const code = await new Promise<number | null>((resolve) => child.on('exit', resolve));
		expect(code).toBe(0);
		expect(JSON.parse(out)).toMatchObject({ product: 'pyramid', stored_in: 'file' });
		expect(out + err).not.toContain(KEY);
		expect(err).toContain('reading key from stdin…');
	}, 20_000);
});
