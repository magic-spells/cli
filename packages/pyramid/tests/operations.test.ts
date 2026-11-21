// Unit tests for the operation registry (src/operations/index.ts) — pure, NO
// network. Each op's `run` is exercised with a MOCKED client + resolver (the
// `OpContext` seam), so we assert the operation contract in isolation:
//
//   - it resolves human names/keys to ids via the resolver,
//   - it calls the right client method,
//   - it hydrates ids back into names in the output (names-in / names-out),
//   - destructive ops refuse to act when `config.allowDestructive` is false.

import { describe, it, expect, vi } from 'vitest';

import { MagicError as McpError, callTool, loadCliConfig, type CliConfig } from '@magic-spells/kit';

import { pyramidError } from '../src/errors.js';
import { hydrateTaskSummary } from '../src/hydrate.js';
import { operationsByName, type OpContext } from '../src/operations/index.js';
import type { TaskDetail, Workflow, WhoAmI } from '../src/types.js';

// ============ Shared fixtures ============

/**
 * Argument `i` of a mock's first call. The mocks are typed by their (argless)
 * implementations, so `mock.calls[0][1]` does not type-check; this reads it untyped.
 */
function callArg(fn: { mock: { calls: unknown[][] } }, i: number): any {
	return fn.mock.calls[0]?.[i];
}

const CONFIG_SAFE: CliConfig = loadCliConfig({
	products: [{ id: 'pyramid', apiUrl: 'https://pyramid.magicspells.io' }],
	env: {},
});
const CONFIG_DESTRUCTIVE: CliConfig = { ...CONFIG_SAFE, allowDestructive: true };

// A workflow rich enough to drive every resolver/hydration join below.
const APOLLO_WORKFLOW: Workflow = {
	project: {
		id: 'p-apollo',
		handle: 'apollo',
		name: 'Apollo',
		task_prefix: 'APO',
		role: 'admin',
		archived: false,
	},
	stages: [
		{ id: 'stg-todo', key: 'todo', name: 'To Do', position: '1' },
		{ id: 'stg-doing', key: 'doing', name: 'In Progress', position: '2' },
	],
	statuses: [
		{ id: 'st-backlog', key: 'backlog', name: 'Backlog', stage_id: 'stg-todo', position: '1' },
		{ id: 'st-ready', key: 'ready', name: 'Ready', stage_id: 'stg-todo', position: '2' },
		{ id: 'st-review', key: 'review', name: 'In Review', stage_id: 'stg-doing', position: '1' },
	],
	labels: [{ id: 'lb-bug', name: 'bug', color: '#f00' }],
	members: [
		{
			id: 'u-ann',
			display_name: 'Ann Smith',
			email: 'ann@example.com',
			role: 'admin',
			// job_title is the person's OWN title, not the permission role.
			job_title: 'Design Lead',
		},
		{ id: 'u-bob', display_name: 'Bob Jones', email: 'bob@example.com', role: 'member' },
	],
	templates: [],
};

/**
 * A mock resolver covering the methods the ops below call. Each method returns
 * the workflow-derived shape the real Resolver would (carrying UUIDs), so the op
 * can hand those UUIDs to the client. Only the surface the tests touch is mocked.
 */
function makeResolver() {
	return {
		resolveProject: vi.fn(async (_name: string) => APOLLO_WORKFLOW.project),
		getWorkflow: vi.fn(async (_projectId: string) => APOLLO_WORKFLOW),
		resolveStatus: vi.fn(async (_pid: string, q: string, stage?: string) => {
			// With a stage, only its statuses count (mirrors the real resolver).
			const scope = APOLLO_WORKFLOW.stages.find((g) => g.name === stage || g.key === stage);
			let s = APOLLO_WORKFLOW.statuses.find(
				(x) =>
					(!scope || x.stage_id === scope.id) &&
					(x.name.toLowerCase() === q.toLowerCase() || x.key === q)
			);
			if (!s) {
				// A stage name where a status is expected -> that stage's first status by
				// position (DOC-NAME-RESOLUTION), mirroring the real resolver (r3).
				const stg = APOLLO_WORKFLOW.stages.find(
					(g) => g.name.toLowerCase() === q.toLowerCase() || g.key === q
				);
				if (stg) {
					s = APOLLO_WORKFLOW.statuses
						.filter((x) => x.stage_id === stg.id)
						.sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0))[0];
				}
			}
			if (!s) throw pyramidError('status_not_found', `No status "${q}".`);
			const owner = APOLLO_WORKFLOW.stages.find((g) => g.id === s.stage_id)!;
			return { ...s, stage_name: owner.name };
		}),
		resolveStage: vi.fn(async (_pid: string, q: string) => {
			const g = APOLLO_WORKFLOW.stages.find(
				(x) => x.name.toLowerCase() === q.toLowerCase() || x.key === q
			);
			if (!g) throw pyramidError('stage_not_found', `No stage "${q}".`);
			return g;
		}),
		resolveUser: vi.fn(async (_pid: string, q: string) => {
			const m = APOLLO_WORKFLOW.members.find(
				(x) => x.email === q || x.display_name.toLowerCase() === q.toLowerCase()
			);
			if (!m) throw pyramidError('user_not_found', `No user "${q}".`);
			return m;
		}),
		resolveLabel: vi.fn(async (_pid: string, q: string) => {
			const l = APOLLO_WORKFLOW.labels.find((x) => x.name === q);
			if (!l) throw pyramidError('label_not_found', `No label "${q}".`);
			return { id: l.id, name: l.name };
		}),
		invalidate: vi.fn(),
	};
}

/** Assemble an OpContext from a client mock + a resolver mock + a config. */
function makeCtx(
	client: Record<string, unknown>,
	resolver: ReturnType<typeof makeResolver>,
	config: CliConfig = CONFIG_SAFE
): OpContext {
	return {
		config,
		session: {
			product: 'pyramid',
			key: 'pyramid_ab23cd45_0123456789abcdef0123456789abcdef',
			source: 'env',
		},
		client: { api: client as never, resolver: resolver as never },
		signal: new AbortController().signal,
	};
}

// ============ Phase-1 ops against the REAL registry ============

describe('operation: list_projects (real registry)', () => {
	it('hydrates raw rows to ProjectSummary with archived derived from archived_at', async () => {
		const op = operationsByName.get('pyramid.project.list')!;
		expect(op).toBeDefined();

		const client = {
			listProjects: vi.fn(async () => [
				{ id: 'p1', handle: 'apollo', name: 'Apollo', task_prefix: 'APO', my_role: 'admin' },
				{
					id: 'p2',
					handle: 'gemini',
					name: 'Gemini',
					task_prefix: 'GEM',
					my_role: 'viewer',
					archived_at: '2026-01-01T00:00:00Z',
				},
			]),
		};
		const resolver = makeResolver();
		const out = (await op.run({}, makeCtx(client, resolver))) as Array<{
			id: string;
			role: string;
			archived: boolean;
		}>;

		expect(client.listProjects).toHaveBeenCalledOnce();
		expect(out).toHaveLength(2);
		// the server names the caller's role `my_role` (model.ProjectWithRole).
		expect(out[0]).toMatchObject({ id: 'p1', role: 'admin', archived: false });
		// archived_at present -> archived true (the names-in/derive-out contract).
		expect(out[1]).toMatchObject({ id: 'p2', role: 'viewer', archived: true });
	});
});

describe('operation: get_project_workflow (real registry)', () => {
	it('resolves the project name to an id, then fetches the workflow by id', async () => {
		const op = operationsByName.get('pyramid.project.workflow')!;
		const client = {}; // the op talks to the resolver only
		const resolver = makeResolver();

		const out = (await op.run({ project: 'apollo' }, makeCtx(client, resolver))) as Workflow;

		// names in: "apollo" -> resolveProject; ids out to getWorkflow.
		expect(resolver.resolveProject).toHaveBeenCalledWith('apollo');
		expect(resolver.getWorkflow).toHaveBeenCalledWith('p-apollo');
		expect(out.project.id).toBe('p-apollo');
		expect(out.statuses).toHaveLength(3);
	});
});

describe('operation: list_my_tasks (real registry)', () => {
	it('hydrates each row against its project workflow and surfaces the cursor', async () => {
		const op = operationsByName.get('pyramid.task.list-mine')!;
		const client = {
			// raw rows keyed by UUID; project_id drives per-project workflow hydration.
			listMyTasks: vi.fn(async () => ({
				data: [
					{
						id: 't1',
						key: 'APO-1',
						title: 'Wire auth',
						status_id: 'st-review',
						owner_id: 'u-ann',
						project_id: 'p-apollo',
						updated_at: '2026-06-01T00:00:00Z',
					},
				],
				cursor: 'CUR-NEXT',
			})),
		};
		const resolver = makeResolver();

		const page = (await op.run({}, makeCtx(client, resolver))) as {
			items: Array<{
				key: string;
				status: { name: string };
				stage: { name: string };
				owner: { display_name: string } | null;
			}>;
			next_cursor: string | null;
			has_more: boolean;
		};

		expect(client.listMyTasks).toHaveBeenCalledOnce();
		// names hydrated alongside UUIDs (status/stage/owner all joined).
		expect(page.items[0]).toMatchObject({
			key: 'APO-1',
			status: { name: 'In Review' },
			stage: { name: 'In Progress' }, // derived from the status's stage_id
			owner: { display_name: 'Ann Smith' },
		});
		// the feed sends no labels, so the summary claims none rather than [].
		expect(page.items[0]).not.toHaveProperty('labels');
		// pagination surfaced, never truncated (DOC-DESIGN-RULES r8).
		expect(page.next_cursor).toBe('CUR-NEXT');
		expect(page.has_more).toBe(true);
	});

	it('caps the page with the requested limit, and never sends a `role` the server ignores', async () => {
		const op = operationsByName.get('pyramid.task.list-mine')!;
		const client = {
			listMyTasks: vi.fn(async (q: { role?: string; limit?: number; cursor?: string }) => {
				expect(q.limit).toBe(5);
				// `?role=` is accepted-and-ignored server-side, so we must not send it.
				expect(q).not.toHaveProperty('role');
				return { data: [], cursor: null };
			}),
		};
		const resolver = makeResolver();
		const page = (await op.run({ limit: 5 }, makeCtx(client, resolver))) as {
			next_cursor: string | null;
			has_more: boolean;
		};
		expect(client.listMyTasks).toHaveBeenCalledOnce();
		// null cursor -> last page.
		expect(page.next_cursor).toBeNull();
		expect(page.has_more).toBe(false);
	});

	it('exposes NO `role` input at all (the server ignores the filter)', () => {
		const op = operationsByName.get('pyramid.task.list-mine')!;
		expect(Object.keys(op.input.shape)).toEqual(['limit', 'cursor']);
	});
});

describe('operation: whoami (real registry)', () => {
	it('assembles user + pinned workspace + projects from three client calls', async () => {
		const op = operationsByName.get('pyramid.whoami')!;
		const client = {
			getMe: vi.fn(async () => ({
				id: 'u-ann',
				display_name: 'Ann Smith',
				email: 'ann@example.com',
			})),
			listProjects: vi.fn(async () => [
				{ id: 'p-apollo', handle: 'apollo', name: 'Apollo', task_prefix: 'APO', my_role: 'admin' },
			]),
			listWorkspaces: vi.fn(async () => [
				{ id: 'workspace-1', handle: 'acme', name: 'Acme', role: 'owner' },
			]),
		};
		const resolver = makeResolver();

		const out = (await op.run({}, makeCtx(client, resolver))) as WhoAmI;
		expect(out.user).toMatchObject({ id: 'u-ann', email: 'ann@example.com' });
		expect(out.workspace).toMatchObject({ id: 'workspace-1', handle: 'acme', role: 'owner' });
		expect(out.projects).toHaveLength(1);
		expect(out.projects[0]!.handle).toBe('apollo');
	});
});

// ============ Hydration sanity (names-in / names-out invariant) ============

describe('hydrateTaskSummary (invariant: no bare UUID surfaces in a named field)', () => {
	it('joins status/stage/owner/label ids to names via the workflow', () => {
		const summary = hydrateTaskSummary(
			{
				id: 't1',
				key: 'APO-1',
				title: 'x',
				status_id: 'st-review',
				owner_id: 'u-bob',
				labels: [{ id: 'lb-bug', name: 'bug', color: '#f00' }],
				updated_at: '2026-06-01T00:00:00Z',
			},
			APOLLO_WORKFLOW
		);
		expect(summary.status).toEqual({ id: 'st-review', name: 'In Review' });
		expect(summary.stage).toEqual({ id: 'stg-doing', name: 'In Progress' });
		expect(summary.owner).toEqual({ id: 'u-bob', display_name: 'Bob Jones' });
		expect(summary.labels).toEqual(['bug']);
		// a row without labels (no ?expand) omits the key instead of claiming none.
		expect(hydrateTaskSummary({ id: 't2' }, APOLLO_WORKFLOW)).not.toHaveProperty('labels');
	});
});

// ============ Phase-2 write surface against the REAL registry ============
//
// These blocks run the shipped write ops (task.create / task.move / task.delete /
// comment.reply, looked up by name on `operationsByName`) through the same
// OpContext seam — a fixture workflow + a mock resolver + a mock client. They
// assert the FILE-OPERATIONS contract on the real code:
//   - human names/keys resolve to UUIDs before the client call (names-in),
//   - the right client method is called with those UUIDs (never a fractional
//     position; neighbor tasks are passed by their resolved id),
//   - the result is hydrated back to names (names-out),
//   - the destructive gate (destructive_action_disabled) fires BEFORE any write.
//
// NOTE — task-ref resolution: the ops resolve a "WEB-42" key or UUID via the
// CLIENT (resolveTaskRef -> client.searchTasks for a key, client.getTask for a
// UUID), not the resolver, so the mocks here implement those client methods. A search row
// carries `{ id, key, project_id }`; we mint a stable `id-<KEY>` id per key so the
// assertions can name the exact UUID handed to the client.

/** A UUID-shaped string the real `resolveTaskRef` accepts via the UUID branch. */
const TASK_UUID = '11111111-1111-4111-8111-111111111111';

/** One task exactly as the server serialises it (model.Task, GET /tasks/{id} without expand). */
const SERVER_TASK = {
	id: TASK_UUID,
	project_id: 'p-apollo',
	template_id: null,
	number: 42,
	key: 'APO-42',
	title: 'Ship it',
	description: null,
	guest_visible: true,
	status_id: 'st-review',
	priority: 'high',
	owner_id: 'u-ann',
	reviewer_id: null,
	task_group_id: null,
	release_id: null,
	due_date: '2026-12-01T00:00:00Z',
	start_date: null,
	completed_at: null,
	estimate_points: null,
	estimate_hours: 3.5,
	position: 'a0',
	cover_image_url: null,
	archived_at: null,
	metadata: {},
	created_by: 'u-ann',
	created_at: '2026-11-01T09:00:00Z',
	updated_at: '2026-11-02T09:00:00Z',
};

describe('task output carries what the server sends', () => {
	it('a list row has priority and due date, the fields work is picked by', async () => {
		const op = operationsByName.get('pyramid.task.list')!;
		const listTasks = vi.fn(async () => ({ data: [SERVER_TASK], cursor: null }));
		const page = (await op.run({ project: 'apollo' }, makeCtx({ listTasks }, makeResolver()))) as {
			items: Record<string, unknown>[];
		};
		expect(page.items[0]).toMatchObject({ priority: 'high', due_date: '2026-12-01T00:00:00Z' });
		expect(page.items[0]).not.toHaveProperty('estimate_hours');
	});

	it('task get adds the dates, the estimate and guest visibility; null stays null', async () => {
		const op = operationsByName.get('pyramid.task.get')!;
		const getTask = vi.fn(async () => SERVER_TASK);
		const out = (await op.run(
			{ task: TASK_UUID },
			makeCtx({ getTask }, makeResolver())
		)) as TaskDetail;
		expect(out).toMatchObject({
			priority: 'high',
			due_date: '2026-12-01T00:00:00Z',
			start_date: null,
			estimate_hours: 3.5,
			completed_at: null,
			guest_visible: true,
			created_at: '2026-11-01T09:00:00Z',
		});
	});
});

/**
 * A client mock whose task-ref reads (searchTasks for keys, getTask for UUIDs)
 * mirror the rows the real Pyramid server returns. `searchTasks` echoes a single
 * row whose `id` is `id-<KEY>` so a test can assert the exact resolved UUID; the
 * write method under test is injected per case.
 */
function makeRefClient(extra: Record<string, unknown>) {
	return {
		// key -> one matching row (id derived from the key, project_id = apollo).
		searchTasks: vi.fn(async (q: { q: string }) => ({
			data: [{ id: `id-${q.q}`, key: q.q, project_id: 'p-apollo' }],
			cursor: null,
		})),
		// UUID -> a task row carrying its project + key.
		getTask: vi.fn(async (id: string) => ({
			id,
			key: 'APO-1',
			project_id: 'p-apollo',
			status_id: 'st-review',
		})),
		...extra,
	};
}

// --- task.create (real op) ------------------------------------------------

describe('operation: create_task (real registry)', () => {
	it('resolves project/status/owner/labels to UUIDs, calls createTask with the REAL contract, and hydrates', async () => {
		const op = operationsByName.get('pyramid.task.create')!;
		expect(op).toBeDefined();

		const resolver = makeResolver();
		const createTask = vi.fn(async () => ({
			id: 't-new',
			key: 'APO-7',
			title: 'Wire auth',
			status_id: 'st-review',
			owner_id: 'u-ann',
			updated_at: '2026-06-16T00:00:00Z',
		}));
		const ctx = makeCtx({ createTask }, resolver);

		const out = (await op.run(
			{
				project: 'apollo',
				title: 'Wire auth',
				status: 'In Review',
				owner: 'ann@example.com',
				labels: ['bug'],
			},
			ctx
		)) as TaskDetail;

		// names in -> ids: every human token went through the resolver.
		expect(resolver.resolveProject).toHaveBeenCalledWith('apollo');
		expect(resolver.resolveStatus).toHaveBeenCalledWith('p-apollo', 'In Review', undefined);
		expect(resolver.resolveUser).toHaveBeenCalledWith('p-apollo', 'ann@example.com');
		expect(resolver.resolveLabel).toHaveBeenCalledWith('p-apollo', 'bug');

		// REAL contract: ownership is FLAT — owner resolves to a top-level owner_id,
		// with no stage anywhere. Labels are label_ids.
		expect(createTask).toHaveBeenCalledWith('p-apollo', {
			title: 'Wire auth',
			status_id: 'st-review',
			owner_id: 'u-ann',
			label_ids: ['lb-bug'],
		});
		const body = callArg(createTask, 1) as Record<string, unknown>;
		expect(body).not.toHaveProperty('stage_responsibilities');
		expect(body).not.toHaveProperty('custom_fields');

		// ids out -> names: the detail hydrates, deriving stage from the status.
		expect(out).toMatchObject({
			key: 'APO-7',
			status: { id: 'st-review', name: 'In Review' },
			stage: { id: 'stg-doing', name: 'In Progress' },
			owner: { id: 'u-ann', display_name: 'Ann Smith' },
		});
	});

	it('maps custom_fields to a field_values MAP keyed by field UUID (not a custom_fields array)', async () => {
		const op = operationsByName.get('pyramid.task.create')!;
		const resolver = makeResolver();
		// Give the workflow a template with one field so resolveFieldValues can map it.
		resolver.getWorkflow.mockResolvedValue({
			...APOLLO_WORKFLOW,
			templates: [
				{
					id: 'tpl',
					name: 'Default',
					fields: [{ id: 'fld-sev', key: 'severity', name: 'Severity', field_type: 'select' }],
				},
			],
		} as never);
		const createTask = vi.fn(async () => ({
			id: 't',
			key: 'APO-9',
			title: 'X',
			status_id: 'st-review',
			updated_at: '2026-06-16T00:00:00Z',
		}));
		const ctx = makeCtx({ createTask }, resolver);

		await op.run(
			{
				project: 'apollo',
				title: 'X',
				status: 'In Review',
				custom_fields: [{ field: 'severity', value: 'high' }],
			},
			ctx
		);

		const body = callArg(createTask, 1) as Record<string, unknown>;
		expect(body.field_values).toEqual({ 'fld-sev': 'high' });
		expect(body).not.toHaveProperty('custom_fields');
	});

	it("stage without status picks the stage's first status by position (r3)", async () => {
		const op = operationsByName.get('pyramid.task.create')!;
		const resolver = makeResolver();
		const createTask = vi.fn(async (_p: string, body: { status_id: string }) => ({
			id: 't',
			key: 'APO-8',
			title: 'Triage',
			status_id: body.status_id,
			updated_at: '2026-06-16T00:00:00Z',
		}));
		const ctx = makeCtx({ createTask }, resolver);

		await op.run({ project: 'apollo', title: 'Triage', stage: 'To Do' }, ctx);

		// "To Do" -> first status by position is Backlog (position '1'); the resolver
		// maps a stage name where a status is expected (r3) to that first status.
		expect(createTask).toHaveBeenCalledWith(
			'p-apollo',
			expect.objectContaining({ status_id: 'st-backlog' })
		);
	});

	it('resolves the status inside the named stage: one the stage lacks is not found, BEFORE any write', async () => {
		const op = operationsByName.get('pyramid.task.create')!;
		const resolver = makeResolver();
		const createTask = vi.fn();
		const ctx = makeCtx({ createTask }, resolver);

		await expect(
			// "In Review" lives in stage "In Progress", not "To Do".
			op.run({ project: 'apollo', title: 'X', status: 'In Review', stage: 'To Do' }, ctx)
		).rejects.toMatchObject({ code: 'not_found', details: { kind: 'status' } });

		expect(resolver.resolveStatus).toHaveBeenCalledWith('p-apollo', 'In Review', 'To Do');
		expect(createTask).not.toHaveBeenCalled();
	});

	it('owner with NO status/stage is just a top-level owner_id (no stage is derived at all)', async () => {
		const op = operationsByName.get('pyramid.task.create')!;
		const resolver = makeResolver();
		const createTask = vi.fn(async () => ({
			id: 't',
			key: 'APO-9',
			title: 'X',
			status_id: 'st-backlog',
			updated_at: '2026-06-16T00:00:00Z',
		}));
		const ctx = makeCtx({ createTask }, resolver);

		await op.run({ project: 'apollo', title: 'X', owner: 'Bob Jones' }, ctx);

		// No status/stage named -> the backend picks the default status itself, and
		// ownership needs no stage to hang on, so the op resolves NOTHING extra.
		const body = callArg(createTask, 1) as Record<string, unknown>;
		expect(body.owner_id).toBe('u-bob');
		expect(body).not.toHaveProperty('stage_responsibilities');
		expect(body).not.toHaveProperty('status_id');
	});

	it('forwards priority / due_date / estimate_hours / client_* onto the create body', async () => {
		const op = operationsByName.get('pyramid.task.create')!;
		const resolver = makeResolver();
		const createTask = vi.fn(async () => ({
			id: 't',
			key: 'APO-9',
			title: 'X',
			status_id: 'st-backlog',
			updated_at: '2026-06-16T00:00:00Z',
		}));
		const ctx = makeCtx({ createTask }, resolver);

		await op.run(
			{
				project: 'apollo',
				title: 'X',
				priority: 'high',
				due_date: '2026-07-01',
				estimate_hours: 4,
				guest_visible: true,
			},
			ctx
		);

		const body = callArg(createTask, 1) as Record<string, unknown>;
		expect(body).toMatchObject({
			priority: 'high',
			due_date: '2026-07-01',
			estimate: 4, // estimate_hours -> the backend's `estimate`
			guest_visible: true,
		});
	});
});

// --- search_tasks (real op) -----------------------------------------------

describe('operation: search_tasks (real registry)', () => {
	it('searches full-text and hydrates each result against its own project workflow', async () => {
		const op = operationsByName.get('pyramid.task.search')!;
		expect(op).toBeDefined();

		const resolver = makeResolver();
		const searchTasks = vi.fn(async () => ({
			data: [
				{ id: 't1', project_id: 'p-apollo', key: 'APO-1', title: 'Hit', status_id: 'st-review' },
			],
			cursor: null,
		}));
		const out = (await op.run({ query: 'hit' }, makeCtx({ searchTasks }, resolver))) as {
			items: Array<{ key: string }>;
		};

		expect(searchTasks).toHaveBeenCalledWith({ q: 'hit', limit: expect.any(Number) });
		expect(out.items).toHaveLength(1);
		expect(out.items[0]!.key).toBe('APO-1');
	});
});

// --- list_comments (real op) ----------------------------------------------

describe('operation: list_comments (real registry)', () => {
	it('resolves the task ref then lists + hydrates its comments', async () => {
		const op = operationsByName.get('pyramid.comment.list')!;
		expect(op).toBeDefined();

		const TASK_UUID = '11111111-1111-1111-1111-111111111111';
		const resolver = makeResolver();
		const getTask = vi.fn(async () => ({
			id: TASK_UUID,
			project_id: 'p-apollo',
			key: 'APO-42',
			status_id: 'st-backlog',
		}));
		const listComments = vi.fn(async () => ({
			data: [
				{ id: 'c1', task_id: TASK_UUID, stage_id: 'stg-todo', content: 'hi', author_id: 'u-ann' },
			],
			cursor: null,
		}));
		const out = (await op.run(
			{ task: TASK_UUID },
			makeCtx({ getTask, listComments }, resolver)
		)) as { items: Array<{ id: string }> };

		expect(listComments).toHaveBeenCalled();
		expect(out.items).toHaveLength(1);
	});
});

// --- task.move (real op) --------------------------------------------------

describe('operation: move_task (real registry)', () => {
	// The move response is an ENVELOPE { task, previous }; the op hydrates raw.task.
	const moveEnvelope = {
		task: {
			id: 'id-APO-42',
			key: 'APO-42',
			title: 'Ship it',
			status_id: 'st-review',
			updated_at: '2026-06-16T00:00:00Z',
		},
		previous: { status_id: 'st-backlog', position: '1', completed_at: null },
	};

	it('sends the after_task neighbour as before_id (the task above the slot) and hydrates raw.task', async () => {
		const op = operationsByName.get('pyramid.task.move')!;
		expect(op).toBeDefined();

		const resolver = makeResolver();
		const moveTask = vi.fn(async () => moveEnvelope);
		const client = makeRefClient({ moveTask });
		const ctx = makeCtx(client, resolver);

		const out = (await op.run(
			{ task: 'APO-42', status: 'In Review', after_task: 'APO-10' },
			ctx
		)) as TaskDetail;

		// both the task and its neighbor were resolved via the client (key -> id).
		expect(client.searchTasks).toHaveBeenCalledWith(expect.objectContaining({ q: 'APO-42' }));
		expect(client.searchTasks).toHaveBeenCalledWith(expect.objectContaining({ q: 'APO-10' }));
		expect(resolver.resolveStatus).toHaveBeenCalledWith('p-apollo', 'In Review', undefined);

		// REAL contract (task_move.go): before_id is the record ABOVE the slot, so
		// "after APO-10" sends APO-10 as before_id. Never a position key — positions
		// are server-generated (DOC-DESIGN-RULES r6).
		expect(moveTask).toHaveBeenCalledWith('id-APO-42', {
			status_id: 'st-review',
			before_id: 'id-APO-10',
		});
		const body = callArg(moveTask, 1) as Record<string, unknown>;
		expect(body).not.toHaveProperty('position');
		expect(body).not.toHaveProperty('after_task_id');

		// hydrated from raw.task (the envelope's task), NOT the whole envelope.
		expect(out).toMatchObject({ key: 'APO-42', status: { name: 'In Review' } });
		expect(out).not.toHaveProperty('previous');
	});

	it('sends the before_task neighbour as after_id (the task below the slot)', async () => {
		const op = operationsByName.get('pyramid.task.move')!;
		const resolver = makeResolver();
		const moveTask = vi.fn(async () => moveEnvelope);
		const client = makeRefClient({ moveTask });
		const ctx = makeCtx(client, resolver);

		await op.run({ task: 'APO-42', status: 'In Review', before_task: 'APO-11' }, ctx);

		expect(moveTask).toHaveBeenCalledWith('id-APO-42', {
			status_id: 'st-review',
			after_id: 'id-APO-11',
		});
	});

	it('rejects after_task + before_task together with validation_failed, before any resolve/move', async () => {
		const op = operationsByName.get('pyramid.task.move')!;
		const resolver = makeResolver();
		const moveTask = vi.fn();
		const client = makeRefClient({ moveTask });
		const ctx = makeCtx(client, resolver);

		await expect(
			op.run(
				{
					task: 'APO-42',
					status: 'In Review',
					after_task: 'APO-10',
					before_task: 'APO-11',
				},
				ctx
			)
		).rejects.toMatchObject({ code: 'validation_failed' });

		// the guard fires first — no task-ref resolution, no move.
		expect(client.searchTasks).not.toHaveBeenCalled();
		expect(moveTask).not.toHaveBeenCalled();
	});

	it('resolves the status inside `stage`, the one way to pick a repeated status name', async () => {
		const op = operationsByName.get('pyramid.task.move')!;
		expect(op.input.shape).toHaveProperty('stage');
		const resolver = makeResolver();
		const moveTask = vi.fn(async () => moveEnvelope);
		const ctx = makeCtx(makeRefClient({ moveTask }), resolver);

		await op.run({ task: 'APO-42', status: 'In Review', stage: 'In Progress' }, ctx);

		expect(resolver.resolveStatus).toHaveBeenCalledWith('p-apollo', 'In Review', 'In Progress');
		expect(moveTask).toHaveBeenCalledWith('id-APO-42', { status_id: 'st-review' });
	});
});

// --- comment.reply (real op) ----------------------------------------------
//
// The server has no GET /comments/{id}: the op posts the reply straight away (the
// server rejects a reply to a reply) and hydrates against the reply's project_id.

describe('operation: reply_to_comment (real registry)', () => {
	it('posts the reply without reading the comment first, then hydrates via its project_id', async () => {
		const op = operationsByName.get('pyramid.comment.reply')!;
		expect(Object.keys(op.input.shape)).toEqual(['comment_id', 'content']);

		const resolver = makeResolver();
		const replyComment = vi.fn(async () => ({
			id: 'c-new',
			task_id: TASK_UUID,
			project_id: 'p-apollo',
			stage_id: 'stg-doing',
			author_id: 'u-ann',
			content: 'ack',
			created_at: '2026-06-16T00:00:00Z',
		}));
		// replyComment is the ONLY client method: any other call would throw.
		const ctx = makeCtx({ replyComment }, resolver);

		const out = (await op.run({ comment_id: 'c-root', content: 'ack' }, ctx)) as {
			id: string;
			author: { display_name: string };
			stage: { name: string };
		};

		expect(replyComment).toHaveBeenCalledWith('c-root', { content: 'ack' });
		expect(resolver.getWorkflow).toHaveBeenCalledWith('p-apollo');
		expect(out.id).toBe('c-new');
		// a comment author is a person too — same stub, job_title included.
		expect(out.author).toEqual({
			id: 'u-ann',
			display_name: 'Ann Smith',
			job_title: 'Design Lead',
		});
		expect(out.stage).toEqual({ id: 'stg-doing', name: 'In Progress' });
	});
});

// --- task.delete (real op, destructive gate) ------------------------------

describe('operation: delete_task (real registry)', () => {
	it('is gated by meta.destructive in the front-ends, never touching the client', async () => {
		const op = operationsByName.get('pyramid.task.delete')!;
		expect(op).toBeDefined();
		expect(op.meta?.destructive).toBe(true);

		const resolver = makeResolver();
		const deleteTask = vi.fn();
		const client = makeRefClient({ deleteTask });
		const ctx = makeCtx(client, resolver, CONFIG_SAFE);

		const r = await callTool('pyramid', op, async () => ctx, { task: 'APO-42', yes: true });
		expect(r.isError).toBe(true);
		expect(JSON.parse(r.content[0]!.text).error.code).toBe('destructive_action_disabled');
		expect(client.searchTasks).not.toHaveBeenCalled();
		expect(deleteTask).not.toHaveBeenCalled();
	});

	it('resolves the key and calls deleteTask(id, true) when allowDestructive is true', async () => {
		const op = operationsByName.get('pyramid.task.delete')!;
		const resolver = makeResolver();
		const deleteTask = vi.fn(async () => undefined);
		const client = makeRefClient({ deleteTask });
		const ctx = makeCtx(client, resolver, CONFIG_DESTRUCTIVE);

		const out = (await op.run({ task: 'APO-42' }, ctx)) as {
			id: string;
			key: string;
			deleted: true;
		};

		// key -> id via the client, then a HARD delete (hard = true).
		expect(client.searchTasks).toHaveBeenCalledWith(expect.objectContaining({ q: 'APO-42' }));
		expect(deleteTask).toHaveBeenCalledWith('id-APO-42', true);
		expect(out).toEqual({ id: 'id-APO-42', key: 'APO-42', deleted: true });
	});
});

// --- update_task (real op, PATCH + label/field fan-out) --------------------
//
// REAL contract: the PATCH body carries the content fields AND owner_id/
// reviewer_id (an explicit null clears one). Only labels and field_values still
// FAN OUT to their dedicated endpoints. The op re-fetches + hydrates the task at
// the end. (The If-Match read-first flow lives inside the client's updateTask/
// deleteTask and is tested at the client level.)

describe('operation: update_task (real registry)', () => {
	it('sends owner/reviewer ON the PATCH and fans only labels/fields out to dedicated endpoints', async () => {
		const op = operationsByName.get('pyramid.task.update')!;
		expect(op).toBeDefined();

		const resolver = makeResolver();
		// Workflow with a custom-field so field_values can resolve.
		resolver.getWorkflow.mockResolvedValue({
			...APOLLO_WORKFLOW,
			templates: [
				{
					id: 'tpl',
					name: 'Default',
					fields: [{ id: 'fld-sev', key: 'severity', name: 'Severity', field_type: 'select' }],
				},
			],
		} as never);

		const updateTask = vi.fn(async () => ({ id: TASK_UUID }));
		const addTaskLabels = vi.fn(async () => ({}));
		const removeTaskLabel = vi.fn(async () => undefined);
		const setFieldValues = vi.fn(async () => ({}));
		// getTask: the ref lookup (UUID branch) + the final re-fetch both call it.
		const getTask = vi.fn(async (id: string, expand?: string) => ({
			id,
			key: 'APO-1',
			project_id: 'p-apollo',
			status_id: 'st-review',
			title: 'Renamed',
			updated_at: '2026-06-16T00:00:00Z',
			...(expand && { labels: [{ id: 'lb-bug', name: 'bug' }] }),
		}));
		const client = {
			getTask,
			updateTask,
			addTaskLabels,
			removeTaskLabel,
			setFieldValues,
		};
		const ctx = makeCtx(client, resolver);

		const out = (await op.run(
			{
				task: TASK_UUID,
				title: 'Renamed',
				priority: 'high',
				owner: 'ann@example.com',
				add_labels: ['bug'],
				custom_fields: [{ field: 'severity', value: 'high' }],
			},
			ctx
		)) as TaskDetail;

		// 1) ONE patch carries the content keys AND the resolved owner_id — no
		// separate ownership write, so it is covered by the same If-Match.
		expect(updateTask).toHaveBeenCalledWith(TASK_UUID, {
			title: 'Renamed',
			priority: 'high',
			owner_id: 'u-ann',
		});
		const patch = callArg(updateTask, 1) as Record<string, unknown>;
		expect(patch).not.toHaveProperty('add_label_ids');
		expect(patch).not.toHaveProperty('field_values');
		expect(patch).not.toHaveProperty('stage_id');

		// 2) labels -> ONE POST /labels carrying every resolved id.
		expect(addTaskLabels).toHaveBeenCalledWith(TASK_UUID, ['lb-bug']);
		// custom_fields -> PATCH /field-values keyed by field UUID.
		expect(setFieldValues).toHaveBeenCalledWith(TASK_UUID, {
			values: { 'fld-sev': 'high' },
		});

		// 3) the op re-fetched + hydrated the final task, expanded so the added label shows.
		expect(getTask).toHaveBeenLastCalledWith(TASK_UUID, 'owner,reviewer,labels');
		expect(out).toMatchObject({ key: 'APO-1', title: 'Renamed', labels: ['bug'] });
	});

	it('surfaces WHICH sub-update failed (add_labels) with its code', async () => {
		const op = operationsByName.get('pyramid.task.update')!;
		const resolver = makeResolver();
		const getTask = vi.fn(async (id: string) => ({
			id,
			key: 'APO-1',
			project_id: 'p-apollo',
			status_id: 'st-review',
		}));
		const addTaskLabels = vi.fn(async () => {
			throw pyramidError('permission_denied', 'nope');
		});
		const client = { getTask, addTaskLabels };
		const ctx = makeCtx(client, resolver);

		const err = await op
			.run({ task: TASK_UUID, add_labels: ['bug'] }, ctx)
			.then(() => undefined)
			.catch((e) => e as McpError);
		expect(err).toBeInstanceOf(McpError);
		expect(err?.code).toBe('permission_denied');
		expect(err?.message).toMatch(/add_labels/);
	});

	it('clears an owner with an explicit null (the null must SURVIVE onto the patch)', async () => {
		const op = operationsByName.get('pyramid.task.update')!;
		const resolver = makeResolver();
		const updateTask = vi.fn(async () => ({ id: TASK_UUID }));
		const getTask = vi.fn(async (id: string) => ({
			id,
			key: 'APO-1',
			project_id: 'p-apollo',
			status_id: 'st-review',
			updated_at: '2026-06-16T00:00:00Z',
		}));
		const ctx = makeCtx({ getTask, updateTask }, resolver);

		await op.run({ task: TASK_UUID, owner: null, reviewer: 'Bob Jones' }, ctx);

		// null clears; it must not be dropped as "unset", and must not be resolved.
		expect(updateTask).toHaveBeenCalledWith(TASK_UUID, {
			owner_id: null,
			reviewer_id: 'u-bob',
		});
		expect(resolver.resolveUser).toHaveBeenCalledTimes(1);
	});

	it('an empty custom_fields list sends no field-values write (the server 422s on {})', async () => {
		const op = operationsByName.get('pyramid.task.update')!;
		const getTask = vi.fn(async (id: string) => ({ id, project_id: 'p-apollo' }));
		const setFieldValues = vi.fn();
		await op.run(
			{ task: TASK_UUID, custom_fields: [] },
			makeCtx({ getTask, setFieldValues }, makeResolver())
		);
		expect(setFieldValues).not.toHaveBeenCalled();
	});
});

// --- create_tasks_bulk (real op) ------------------------------------------

describe('operation: create_tasks_bulk (real registry)', () => {
	it('resolves the template, sends top-level project_id + template_id, and hydrates `created`', async () => {
		const op = operationsByName.get('pyramid.task.create-bulk')!;
		expect(op).toBeDefined();

		const resolver = makeResolver();
		resolver.getWorkflow.mockResolvedValue({
			...APOLLO_WORKFLOW,
			templates: [{ id: 'tpl-default', name: 'Default', fields: [] }],
		} as never);

		const bulkCreate = vi.fn(async () => ({
			created: [
				{
					id: 't1',
					key: 'APO-10',
					title: 'One',
					status_id: 'st-review',
					updated_at: '2026-06-16T00:00:00Z',
				},
			],
			errors: [],
		}));
		const ctx = makeCtx({ bulkCreate }, resolver);

		const out = (await op.run(
			{
				project: 'apollo',
				template: 'Default',
				tasks: [{ title: 'One', status: 'In Review', owner: 'ann@example.com' }],
			},
			ctx
		)) as TaskDetail[];

		const body = callArg(bulkCreate, 0) as {
			project_id: string;
			template_id: string;
			tasks: Record<string, unknown>[];
		};
		// TOP-LEVEL project_id + template_id (resolved from the template name).
		expect(body.project_id).toBe('p-apollo');
		expect(body.template_id).toBe('tpl-default');
		// per-row: a flat owner_id (+ label_ids / field_values where given).
		expect(body.tasks[0]).toMatchObject({
			title: 'One',
			status_id: 'st-review',
			owner_id: 'u-ann',
		});
		expect(body.tasks[0]).not.toHaveProperty('stage_responsibilities');
		// hydrated from `created`.
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({ key: 'APO-10', status: { name: 'In Review' } });
	});

	it('requires a template — a missing one is a clear validation_failed (no write)', async () => {
		const op = operationsByName.get('pyramid.task.create-bulk')!;
		const resolver = makeResolver();
		const bulkCreate = vi.fn();
		const ctx = makeCtx({ bulkCreate }, resolver);

		await expect(
			op.run({ project: 'apollo', tasks: [{ title: 'One' }] }, ctx)
		).rejects.toMatchObject({ code: 'validation_failed' });
		expect(bulkCreate).not.toHaveBeenCalled();
	});

	it('rejects a row or default field the bulk endpoint would silently drop, naming it (no write)', async () => {
		const op = operationsByName.get('pyramid.task.create-bulk')!;
		const bulkCreate = vi.fn();
		const ctx = makeCtx({ bulkCreate }, makeResolver());

		for (const input of [
			{ tasks: [{ title: 'One', priority: 'high' }] },
			{ defaults: { priority: 'high' }, tasks: [{ title: 'One' }] },
		]) {
			const r = await callTool('pyramid', op, async () => ctx, {
				project: 'apollo',
				template: 'Default',
				...input,
			});
			expect(r.isError).toBe(true);
			const { error } = JSON.parse(r.content[0]!.text);
			expect(error.code).toBe('validation_failed');
			expect(error.message).toMatch(/priority/);
		}
		expect(bulkCreate).not.toHaveBeenCalled();
	});
});

// --- create_task: custom-field validation (r7) + flat ownership --------------

describe('create_task: field validation + ownership', () => {
	it('rejects a value whose type mismatches the field_type (r7) before any client call', async () => {
		const op = operationsByName.get('pyramid.task.create')!;
		const resolver = makeResolver();
		resolver.getWorkflow.mockResolvedValue({
			...APOLLO_WORKFLOW,
			templates: [
				{
					id: 'tpl',
					name: 'Default',
					fields: [{ id: 'fld-pts', key: 'points', name: 'Points', field_type: 'number' }],
				},
			],
		} as never);
		const createTask = vi.fn();
		const ctx = makeCtx({ createTask }, resolver);

		await expect(
			op.run(
				{
					project: 'apollo',
					title: 'X',
					status: 'In Review',
					custom_fields: [{ field: 'points', value: 'three' }],
				},
				ctx
			)
		).rejects.toMatchObject({
			code: 'validation_failed',
			details: { reason: 'invalid_field_value' },
		});
		expect(createTask).not.toHaveBeenCalled();
	});

	it('resolves owner AND reviewer to top-level ids; rejects the removed assignments[] input', async () => {
		const op = operationsByName.get('pyramid.task.create')!;
		const resolver = makeResolver();
		const createTask = vi.fn(async () => ({
			id: 't',
			key: 'APO-9',
			title: 'X',
			status_id: 'st-review',
			updated_at: '2026-06-16T00:00:00Z',
		}));
		const ctx = makeCtx({ createTask }, resolver);

		await op.run(
			{
				project: 'apollo',
				title: 'X',
				status: 'In Review',
				owner: 'Ann Smith',
				reviewer: 'Bob Jones',
			},
			ctx
		);

		const body = callArg(createTask, 1) as Record<string, unknown>;
		expect(body.owner_id).toBe('u-ann');
		expect(body.reviewer_id).toBe('u-bob');
		expect(body).not.toHaveProperty('stage_responsibilities');

		// `assignments` is gone from the schema, not silently ignored.
		expect(op.input.shape).not.toHaveProperty('assignments');
	});
});

// --- list_tasks: Owner / Reviewer filters (never "assignee") ----------------

describe('list_tasks: owner/reviewer filters', () => {
	it('resolves --owner and --reviewer to owner_id/reviewer_id, and has no assignee input', async () => {
		const op = operationsByName.get('pyramid.task.list')!;
		const resolver = makeResolver();
		const listTasks = vi.fn(async () => ({ data: [], cursor: null }));
		const ctx = makeCtx({ listTasks }, resolver);

		await op.run({ project: 'apollo', owner: 'ann@example.com', reviewer: 'Bob Jones' }, ctx);

		expect(callArg(listTasks, 1)).toMatchObject({
			owner_id: 'u-ann',
			reviewer_id: 'u-bob',
		});
		// the product says Owner and Reviewer; "assignee" is gone from the surface.
		expect(op.input.shape).not.toHaveProperty('assignee');
		expect(op.input.shape).toHaveProperty('owner');
		expect(op.input.shape).toHaveProperty('reviewer');
	});

	it('asks for the expansion, so its rows carry their real labels', async () => {
		const op = operationsByName.get('pyramid.task.list')!;
		const listTasks = vi.fn(async () => ({
			data: [
				{
					id: 't1',
					key: 'APO-1',
					status_id: 'st-review',
					labels: [{ id: 'lb-bug', name: 'bug', color: '#f00' }],
				},
			],
			cursor: null,
		}));
		const page = (await op.run({ project: 'apollo' }, makeCtx({ listTasks }, makeResolver()))) as {
			items: Array<{ labels?: string[] }>;
		};

		expect(callArg(listTasks, 1)).toMatchObject({ expand: 'owner,reviewer,labels' });
		expect(page.items[0]!.labels).toEqual(['bug']);
	});

	it('labels a hydrated owner with the job_title the workflow already knows', async () => {
		const op = operationsByName.get('pyramid.task.get')!;
		const resolver = makeResolver();
		// A LEAN row (no ?expand): only owner_id. The job_title still lands, because
		// the cached workflow's member rows carry it.
		const getTask = vi.fn(async () => ({
			id: 't1',
			key: 'APO-1',
			project_id: 'p-apollo',
			status_id: 'st-review',
			owner_id: 'u-ann',
			reviewer_id: 'u-bob',
			updated_at: '2026-06-16T00:00:00Z',
		}));
		const out = (await op.run(
			{ task: '33333333-3333-3333-3333-333333333333' },
			makeCtx({ getTask }, resolver)
		)) as TaskDetail;

		expect(out.owner).toMatchObject({ display_name: 'Ann Smith', job_title: 'Design Lead' });
		// no title known -> the key is simply absent, not an empty string.
		expect(out.reviewer).toMatchObject({ display_name: 'Bob Jones' });
		expect(out.reviewer).not.toHaveProperty('job_title');
	});

	it('keeps the expanded stub profile fields when the server sends them', async () => {
		const op = operationsByName.get('pyramid.task.get')!;
		const resolver = makeResolver();
		const getTask = vi.fn(async () => ({
			id: 't1',
			key: 'APO-1',
			project_id: 'p-apollo',
			status_id: 'st-review',
			owner: {
				id: 'u-ann',
				display_name: 'Ann Smith',
				first_name: 'Ann',
				last_name: 'Smith',
				avatar_url: 'https://example.test/a.png',
				job_title: 'Staff Designer',
			},
			updated_at: '2026-06-16T00:00:00Z',
		}));
		const out = (await op.run(
			{ task: '33333333-3333-3333-3333-333333333333', expand: true },
			makeCtx({ getTask }, resolver)
		)) as TaskDetail;

		// the ref lookup reads the task lean; the expand ride-along is the 2nd call.
		expect(getTask).toHaveBeenLastCalledWith('t1', 'owner,reviewer,labels');
		// the expanded row wins over the workflow's copy.
		expect(out.owner).toMatchObject({
			first_name: 'Ann',
			last_name: 'Smith',
			avatar_url: 'https://example.test/a.png',
			job_title: 'Staff Designer',
		});
	});
});

// --- get_task_timeline (real op) -------------------------------------------

describe('operation: get_task_timeline (real registry)', () => {
	const TASK_UUID = '22222222-2222-2222-2222-222222222222';
	const taskRow = { id: TASK_UUID, project_id: 'p-apollo', key: 'APO-1', status_id: 'st-review' };

	it('resolves the task ref, passes limit/cursor/event_type, and hydrates the actor', async () => {
		const op = operationsByName.get('pyramid.task.timeline')!;
		expect(op).toBeDefined();

		const resolver = makeResolver();
		const getTask = vi.fn(async () => taskRow);
		const getTaskTimeline = vi.fn(async () => ({
			data: [
				{
					id: 'ev-1',
					task_id: TASK_UUID,
					event_type: 'owner_changed',
					actor_id: 'u-ann',
					old_value: null,
					new_value: 'u-bob',
					data: { task_id: TASK_UUID },
					created_at: '2026-06-16T00:00:00Z',
				},
			],
			cursor: 'CUR-2',
		}));
		const ctx = makeCtx({ getTask, getTaskTimeline }, resolver);

		const page = (await op.run(
			{ task: TASK_UUID, event_type: 'owner_changed', limit: 10 },
			ctx
		)) as { items: Record<string, unknown>[]; next_cursor: string | null; has_more: boolean };

		expect(getTaskTimeline).toHaveBeenCalledWith(TASK_UUID, {
			limit: 10,
			cursor: undefined,
			event_type: 'owner_changed',
		});

		// the actor is joined to a name, and so are the values of the event types whose
		// shape we KNOW is a bare user uuid (owner_changed / reviewer_changed) — a raw
		// uuid in a history line is unreadable. null stays null.
		expect(page.items[0]).toMatchObject({
			id: 'ev-1',
			event_type: 'owner_changed',
			actor: { id: 'u-ann', display_name: 'Ann Smith' },
			old_value: null,
			new_value: { id: 'u-bob', display_name: 'Bob Jones' },
		});

		// pagination surfaced, never truncated (r8).
		expect(page.next_cursor).toBe('CUR-2');
		expect(page.has_more).toBe(true);
	});

	it('defaults the limit to 50 and tolerates a system event with no actor', async () => {
		const op = operationsByName.get('pyramid.task.timeline')!;
		const resolver = makeResolver();
		const getTask = vi.fn(async () => taskRow);
		const getTaskTimeline = vi.fn(async () => ({
			data: [{ id: 'ev-2', event_type: 'created', data: { task_id: TASK_UUID } }],
			cursor: null,
		}));
		const page = (await op.run(
			{ task: TASK_UUID },
			makeCtx({ getTask, getTaskTimeline }, resolver)
		)) as { items: Record<string, unknown>[]; has_more: boolean };

		expect(callArg(getTaskTimeline, 1)).toMatchObject({ limit: 50 });
		expect(page.items[0]).toMatchObject({ id: 'ev-2', actor: null, task_id: TASK_UUID });
		expect(page.has_more).toBe(false);
	});

	it('is a read: it carries no destructive flag', () => {
		const op = operationsByName.get('pyramid.task.timeline')!;
		expect(op.meta?.destructive).toBeFalsy();
		expect(op.meta?.cli).toMatchObject({ positionals: ['task'] });
	});

	it('leaves an unknown event kind, and an unknown user, exactly as the server sent it', async () => {
		const op = operationsByName.get('pyramid.task.timeline')!;
		const getTask = vi.fn(async () => taskRow);
		const getTaskTimeline = vi.fn(async () => ({
			data: [
				// A kind this client has never heard of: the values are NOT ours to
				// interpret, and it must not crash.
				{
					id: 'ev-3',
					event_type: 'sprint_rolled_over',
					old_value: { sprint: 7 },
					new_value: [1, 2, 3],
					data: { task_id: TASK_UUID },
				},
				// A known kind, but a user the cached workflow has never seen: the raw
				// uuid survives rather than collapsing to a blank name.
				{
					id: 'ev-4',
					event_type: 'reviewer_changed',
					old_value: 'u-stranger',
					new_value: null,
					data: { task_id: TASK_UUID },
				},
			],
			cursor: null,
		}));
		const page = (await op.run(
			{ task: TASK_UUID },
			makeCtx({ getTask, getTaskTimeline }, makeResolver())
		)) as { items: Record<string, unknown>[] };

		expect(page.items[0]).toMatchObject({
			event_type: 'sprint_rolled_over',
			old_value: { sprint: 7 },
			new_value: [1, 2, 3],
		});
		expect(page.items[1]).toMatchObject({ old_value: 'u-stranger', new_value: null });
	});
});

// --- list_comments: stage scoping (default current, "all") -------------------

describe('list_comments: stage scoping', () => {
	const TASK_UUID = '22222222-2222-2222-2222-222222222222';
	const taskRow = { id: TASK_UUID, project_id: 'p-apollo', key: 'APO-1', status_id: 'st-review' };

	it("defaults to the task's CURRENT stage (r4)", async () => {
		const op = operationsByName.get('pyramid.comment.list')!;
		const resolver = makeResolver();
		const getTask = vi.fn(async () => taskRow);
		const listComments = vi.fn(async () => ({ data: [], cursor: null }));
		await op.run({ task: TASK_UUID }, makeCtx({ getTask, listComments }, resolver));
		// st-review lives in stg-doing -> default stage_id = stg-doing.
		expect(callArg(listComments, 1).stage_id).toBe('stg-doing');
	});

	it('lists ALL stages when stage: "all"', async () => {
		const op = operationsByName.get('pyramid.comment.list')!;
		const resolver = makeResolver();
		const getTask = vi.fn(async () => taskRow);
		const listComments = vi.fn(async () => ({ data: [], cursor: null }));
		await op.run({ task: TASK_UUID, stage: 'all' }, makeCtx({ getTask, listComments }, resolver));
		expect(callArg(listComments, 1).stage_id).toBeUndefined();
	});
});
