// `magic pyramid …` end to end against a fake Pyramid API on 127.0.0.1: the shell's
// product runner, the real registry, the real HTTP client, resolver and hydration.
// This is the R0 gate shape (`magic pyramid task next` with a pyk_ key in
// MAGIC_PYRAMID_KEY) without touching production.

import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { runProductCli, type CredentialStore } from '@magic-spells/kit';

import pyramid from '../src/index.js';

const KEY = 'pyk_ab23cd45_0123456789abcdef';

const WORKFLOW = {
	stages: [{ id: 'stg-doing', key: 'doing', name: 'In Progress', position: '1' }],
	statuses: [
		{ id: 'st-review', key: 'review', name: 'In Review', stage_id: 'stg-doing', position: '1' },
	],
};
const MEMBERS = [
	{ id: 'u-ann', display_name: 'Ann Smith', email: 'ann@example.com', role: 'admin' },
];

const ROUTES: Record<string, unknown> = {
	'GET /v1/me': { id: 'u-ann', display_name: 'Ann Smith', email: 'ann@example.com' },
	'GET /v1/workspaces': { data: [{ id: 'w1', handle: 'acme', name: 'Acme', role: 'owner' }] },
	'GET /v1/projects': {
		data: [{ id: 'p-web', handle: 'web', name: 'Website', task_prefix: 'WEB', role: 'admin' }],
	},
	'GET /v1/me/tasks': {
		data: [
			{
				id: 't-42',
				key: 'WEB-42',
				title: 'Ship the CLI',
				description: null,
				project_id: 'p-web',
				status_id: 'st-review',
				owner_id: 'u-ann',
				updated_at: '2026-10-30T00:00:00Z',
			},
		],
		cursor: 'next-page',
	},
	'GET /v1/projects/p-web/workflow': WORKFLOW,
	'GET /v1/projects/p-web/labels': [],
	'GET /v1/projects/p-web/members': MEMBERS,
	'GET /v1/projects/p-web/task-schema': { templates: [] },
};

let server: Server;
let baseUrl = '';
const seen: { method: string; path: string; auth: string | undefined }[] = [];

beforeAll(async () => {
	server = createServer((req: IncomingMessage, res) => {
		const url = new URL(req.url ?? '/', 'http://x');
		seen.push({ method: req.method ?? '', path: url.pathname, auth: req.headers.authorization });
		const body = ROUTES[`${req.method} ${url.pathname}`];
		if (req.headers.authorization !== `Bearer ${KEY}`) {
			res.writeHead(401, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ error: { code: 'unauthorized', message: 'bad key' } }));
			return;
		}
		if (body === undefined) {
			res.writeHead(404, { 'content-type': 'application/json' });
			res.end(
				JSON.stringify({ error: { code: 'not_found', message: `no route ${url.pathname}` } })
			);
			return;
		}
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(JSON.stringify(body));
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
	seen.length = 0;
});

const emptyStore: CredentialStore = {
	backend: 'file',
	get: async () => null,
	locate: async () => null,
	set: async () => {},
	delete: async () => {},
	list: async () => [],
};

async function magicPyramid(argv: string[], env: NodeJS.ProcessEnv = {}, tty = false) {
	const cap = { stdout: '', stderr: '' };
	const code = await runProductCli(pyramid, argv, {
		env: { MAGIC_PYRAMID_KEY: KEY, MAGIC_PYRAMID_URL: baseUrl, ...env },
		store: emptyStore,
		readConfig: () => null,
		io: {
			out: (t) => void (cap.stdout += t),
			err: (t) => void (cap.stderr += t),
			isTTY: () => tty,
		},
	});
	return { code, ...cap };
}

describe('magic pyramid task next', () => {
	it('lists my tasks hydrated to names, with the cursor, using MAGIC_PYRAMID_KEY', async () => {
		const r = await magicPyramid(['task', 'next']);
		expect(r.code).toBe(0);
		const page = JSON.parse(r.stdout);
		expect(page.next_cursor).toBe('next-page');
		expect(page.items[0]).toMatchObject({
			key: 'WEB-42',
			title: 'Ship the CLI',
			status: { name: 'In Review' },
			stage: { name: 'In Progress' },
			owner: { display_name: 'Ann Smith' },
		});
		expect(seen.every((s) => s.auth === `Bearer ${KEY}`)).toBe(true);
		expect(seen.map((s) => s.path)).toContain('/v1/me/tasks');
	});

	it('`task list --mine` routes to the same operation', async () => {
		const r = await magicPyramid(['task', 'list', '--mine', '--limit', '5']);
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout).items).toHaveLength(1);
	});

	it('renders a table on a TTY with the cursor hint on stderr', async () => {
		const r = await magicPyramid(['task', 'next'], {}, true);
		expect(r.stdout).toContain('WEB-42');
		expect(r.stdout).toContain('In Review');
		expect(r.stderr).toContain('more: --cursor next-page');
	});

	it('a bad key is auth_invalid (exit 3) with the regenerate hint', async () => {
		const r = await magicPyramid(['task', 'next'], { MAGIC_PYRAMID_KEY: 'pyk_wrong_key' });
		expect(r.code).toBe(3);
		expect(JSON.parse(r.stderr).error).toMatchObject({ code: 'auth_invalid', product: 'pyramid' });
	});
});

describe('magic pyramid whoami / project list', () => {
	it('whoami prints user, workspace and projects', async () => {
		const r = await magicPyramid(['whoami']);
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout)).toMatchObject({
			user: { display_name: 'Ann Smith', email: 'ann@example.com' },
			workspace: { handle: 'acme', name: 'Acme' },
			projects: [{ handle: 'web', name: 'Website' }],
		});
	});

	it('project list', async () => {
		const r = await magicPyramid(['project', 'list']);
		expect(JSON.parse(r.stdout)).toEqual([
			{
				id: 'p-web',
				handle: 'web',
				name: 'Website',
				task_prefix: 'WEB',
				role: 'admin',
				archived: false,
			},
		]);
	});
});

describe('magic pyramid task delete (destructive gate)', () => {
	it('--yes without MAGIC_ALLOW_DESTRUCTIVE never reaches the API (exit 8)', async () => {
		const r = await magicPyramid(['task', 'delete', 'WEB-42', '--yes']);
		expect(r.code).toBe(8);
		expect(seen).toEqual([]);
	});

	it('PYRAMID_ALLOW_DESTRUCTIVE is no longer read', async () => {
		const r = await magicPyramid(['task', 'delete', 'WEB-42', '--yes'], {
			PYRAMID_ALLOW_DESTRUCTIVE: '1',
		});
		expect(r.code).toBe(8);
	});
});

describe('registry', () => {
	it('every operation is pyramid.<noun>.<verb> and unique', async () => {
		const { assertRegistry } = await import('@magic-spells/kit');
		const ops = await pyramid.load();
		expect(() => assertRegistry('pyramid', ops)).not.toThrow();
		expect(ops).toHaveLength(17);
	});
});
