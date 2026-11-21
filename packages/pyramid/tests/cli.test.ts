// `magic pyramid …` end to end against a fake Pyramid API on 127.0.0.1: the shell's
// product runner, the real registry, the real HTTP client, resolver and hydration.
// This is the R0 gate shape (`magic pyramid task next` with a pyramid_ key in
// MAGIC_PYRAMID_KEY) without touching production.

import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { runProductCli, type CredentialStore } from '@magic-spells/kit';

import pyramid from '../src/index.js';

const KEY = 'pyramid_ab23cd45_0123456789abcdef0123456789abcdef';

const WORKFLOW = {
	stages: [{ id: 'stg-doing', key: 'doing', name: 'In Progress', position: '1' }],
	statuses: [
		{ id: 'st-review', key: 'review', name: 'In Review', stage_id: 'stg-doing', position: '1' },
	],
};
const MEMBERS = [
	{ id: 'u-ann', display_name: 'Ann Smith', email: 'ann@example.com', role: 'admin' },
];

/** WEB-42 as the server's model.Task serialises it. */
const TASK = {
	id: 't-42',
	project_id: 'p-web',
	template_id: null,
	number: 42,
	key: 'WEB-42',
	title: 'Ship the CLI',
	description: null,
	guest_visible: false,
	status_id: 'st-review',
	priority: 'none',
	owner_id: 'u-ann',
	reviewer_id: null,
	task_group_id: null,
	release_id: null,
	due_date: null,
	start_date: null,
	completed_at: null,
	estimate_points: null,
	estimate_hours: null,
	position: 'a0',
	cover_image_url: null,
	archived_at: null,
	metadata: {},
	created_by: 'u-ann',
	created_at: '2026-10-01T00:00:00Z',
	updated_at: '2026-11-10T00:00:00Z',
};
const ARCHIVED = {
	...TASK,
	id: 't-43',
	number: 43,
	key: 'WEB-43',
	archived_at: '2026-11-10T00:00:00Z',
};
/** LATE-1, in a project on the second page of the project list. */
const LATE = { ...TASK, id: 't-late-1', project_id: 'p-late', number: 1, key: 'LATE-1' };

const ROUTES: Record<string, unknown> = {
	'GET /v1/projects/p-web/tasks/by-number/42': TASK,
	'GET /v1/projects/p-web/tasks/by-number/43': ARCHIVED,
	'POST /v1/tasks/t-43/unarchive': { ...ARCHIVED, archived_at: null },
	'GET /v1/tasks/t-42': TASK,
	'PATCH /v1/tasks/t-42': TASK,
	'GET /v1/me': { id: 'u-ann', display_name: 'Ann Smith', email: 'ann@example.com' },
	'GET /v1/workspaces': { data: [{ id: 'w1', handle: 'acme', name: 'Acme', role: 'owner' }] },
	// Two pages: the server's keyset cursor is the last row's id, null on the last page.
	// Keyed exactly, so wrong paging parameters 404 at once instead of looping on page 1.
	'GET /v1/projects?limit=100': {
		data: [{ id: 'p-web', handle: 'web', name: 'Website', task_prefix: 'WEB', my_role: 'admin' }],
		cursor: 'p-web',
	},
	'GET /v1/projects?limit=100&cursor=p-web': {
		data: [{ id: 'p-late', handle: 'late', name: 'Late', task_prefix: 'LATE', my_role: 'member' }],
		cursor: null,
	},
	'GET /v1/projects/p-late/tasks/by-number/1': LATE,
	'GET /v1/tasks/t-late-1': LATE,
	'DELETE /v1/tasks/t-late-1': {},
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
const seen: { method: string; path: string; auth: string | undefined; body: string }[] = [];

beforeAll(async () => {
	server = createServer(async (req: IncomingMessage, res) => {
		const url = new URL(req.url ?? '/', 'http://x');
		let sent = '';
		for await (const chunk of req) sent += chunk;
		seen.push({
			method: req.method ?? '',
			path: url.pathname,
			auth: req.headers.authorization,
			body: sent,
		});
		const body =
			ROUTES[`${req.method} ${url.pathname}${url.search}`] ??
			ROUTES[`${req.method} ${url.pathname}`];
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
		const r = await magicPyramid(['task', 'next'], {
			MAGIC_PYRAMID_KEY: 'pyramid_ffffffff_ffffffffffffffffffffffffffffffff',
		});
		expect(r.code).toBe(3);
		expect(JSON.parse(r.stderr).error).toMatchObject({ code: 'auth_invalid', product: 'pyramid' });
	});
});

describe('magic pyramid whoami / project list', () => {
	it('whoami is not a Pyramid command (identity is root-only: `magic whoami`)', async () => {
		const r = await magicPyramid(['whoami']);
		expect(r.code).toBe(2);
		expect(JSON.parse(r.stderr).error).toMatchObject({ code: 'usage' });
		expect(seen).toEqual([]);
	});

	it('project list follows the cursor through every page', async () => {
		const r = await magicPyramid(['project', 'list']);
		expect(r.stderr).toBe(''); // a page asked for wrongly shows here as the fake's 404
		expect(JSON.parse(r.stdout)).toEqual([
			{
				id: 'p-web',
				handle: 'web',
				name: 'Website',
				task_prefix: 'WEB',
				role: 'admin',
				archived: false,
			},
			{
				id: 'p-late',
				handle: 'late',
				name: 'Late',
				task_prefix: 'LATE',
				role: 'member',
				archived: false,
			},
		]);
	});

	it('a key whose project is on the second page resolves', async () => {
		const r = await magicPyramid(['task', 'delete', 'LATE-1', '--yes'], {
			MAGIC_ALLOW_DESTRUCTIVE: '1',
		});
		expect(r.stderr).toBe('');
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout)).toEqual({ id: 't-late-1', key: 'LATE-1', deleted: true });
	});
});

describe('magic pyramid task archive --unarchive', () => {
	it('reaches an archived task by its key: the prefix names the project, then by number', async () => {
		const r = await magicPyramid(['task', 'archive', 'web-43', '--unarchive']);
		expect(r.code).toBe(0);
		expect(JSON.parse(r.stdout)).toMatchObject({ key: 'WEB-43', archived: false });
		expect(seen.map((s) => `${s.method} ${s.path}`)).toEqual(
			expect.arrayContaining([
				'GET /v1/projects/p-web/tasks/by-number/43',
				'POST /v1/tasks/t-43/unarchive',
			])
		);
	});

	it('a key whose prefix names no project is task not_found, exit 5', async () => {
		const r = await magicPyramid(['task', 'get', 'NOPE-1']);
		expect(r.code).toBe(5);
		expect(JSON.parse(r.stderr).error).toMatchObject({
			code: 'not_found',
			details: { kind: 'task' },
		});
	});
});

describe('magic pyramid task update', () => {
	it('`null` clears a nullable field, in both flag spellings: the PATCH sends JSON null', async () => {
		const r = await magicPyramid([
			'task',
			'update',
			'WEB-42',
			'--owner',
			'null',
			'--description=null',
			'--due-date',
			'null',
			'--estimate',
			'null',
		]);
		expect(r.code).toBe(0);
		const patch = seen.find((s) => s.method === 'PATCH')!;
		expect(JSON.parse(patch.body)).toEqual({
			description: null,
			due_date: null,
			estimate: null,
			owner_id: null,
		});
	});

	it('the estimate is estimate_hours, as on output; --estimate still reaches it', async () => {
		for (const flag of ['--estimate-hours', '--estimate']) {
			seen.length = 0;
			expect((await magicPyramid(['task', 'update', 'WEB-42', flag, '2.5'])).code).toBe(0);
			const patch = seen.find((s) => s.method === 'PATCH')!;
			expect(JSON.parse(patch.body)).toEqual({ estimate: 2.5 });
		}
	});
});

describe('help after a command', () => {
	it('prints the product help and writes nothing: no comment "-h", no task "-h"', async () => {
		for (const argv of [
			['task', 'comment', 'WEB-42', '-h'],
			['task', 'create', '-h', '--project', 'web'],
			['task', 'list', 'web', '--help'],
		]) {
			const r = await magicPyramid(argv);
			expect(r.code).toBe(0);
			expect(r.stderr).toContain('magic pyramid — ');
		}
		expect(seen).toEqual([]);
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
