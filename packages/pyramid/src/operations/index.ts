// The Pyramid operation registry (COMPONENT-PYRAMID-PACKAGE, DATATYPE-OPERATION).
// The one source both front-ends derive from: the kit builds `magic pyramid …` and
// the `pyramid_*` MCP tools from this list. Each operation owns its name resolution,
// API call and hydration; none knows about argv, stdout or MCP.
//
// Names follow `pyramid.<noun>.<verb>` (DECISION-OPERATION-CONTRACT). The CLI keeps
// pyramid-cli's shape through verb aliases: `task next` (list-mine), `task show`
// (get), `task bulk` (create-bulk).

import { z } from 'zod';

import {
	MagicError,
	rec,
	readStr,
	type OpContext as KitOpContext,
	type Operation as KitOperation,
} from '@magic-spells/kit';

import { pyramidError } from '../errors.js';
import type { PyramidClient } from '../client/pyramid-client.js';
import type { Resolver } from '../cache/resolver.js';
import {
	hydrateComment,
	hydrateTaskDetail,
	hydrateTaskSummary,
	hydrateTimelineEvent,
} from '../hydrate.js';
import type {
	Page,
	ProjectSummary,
	TaskComment,
	TaskDetail,
	TaskSummary,
	TimelineEvent,
	WhoAmI,
	Workflow,
} from '../types.js';

// ============ The shared seam ============

/** Pyramid's client as operations see it: the HTTP client plus the name resolver. */
export interface PyramidApi {
	api: PyramidClient;
	resolver: Resolver;
}

/** The kit's OpContext over Pyramid's client (DATATYPE-OPERATION). */
export type OpContext = KitOpContext<PyramidApi>;

/** One Pyramid operation: resolve names -> ids, call the API, hydrate names back. */
export type Operation<I = any, O = unknown> = KitOperation<I, O, PyramidApi>;

const PROJECT_ROLES = ['admin', 'pm', 'member', 'viewer', 'guest'] as const;
type ProjectRole = (typeof PROJECT_ROLES)[number];

function projectRole(v: unknown): ProjectRole {
	return (PROJECT_ROLES as readonly string[]).includes(v as string) ? (v as ProjectRole) : 'member';
}

/** Raw project row -> ProjectSummary (archived derived from archived_at). */
function toProjectSummary(raw: unknown): ProjectSummary {
	const p = rec(raw);
	return {
		id: readStr(p.id) ?? '',
		handle: readStr(p.handle) ?? '',
		name: readStr(p.name) ?? '',
		task_prefix: readStr(p.task_prefix) ?? '',
		role: projectRole(p.role),
		archived: p.archived_at != null || p.archived === true,
	};
}

const WORKSPACE_ROLES = ['owner', 'admin', 'member'] as const;
type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

function workspaceRole(v: unknown): WorkspaceRole {
	return (WORKSPACE_ROLES as readonly string[]).includes(v as string)
		? (v as WorkspaceRole)
		: 'member';
}

// ============ Phase-1 operations ============

// ---------- whoami ----------

const whoami: Operation<Record<string, never>, WhoAmI> = {
	name: 'pyramid.whoami',
	summary: 'Report the authenticated user, their workspace, and accessible projects.',
	input: z.object({}),
	async run(_input, ctx): Promise<WhoAmI> {
		// getMe carries the user (and MAY embed a workspace). When it doesn't, fall
		// back to the key's pinned workspace (the first listWorkspaces entry).
		const [me, projectsRaw, workspaces] = await Promise.all([
			ctx.client.api.getMe(),
			ctx.client.api.listProjects(),
			ctx.client.api.listWorkspaces().catch(() => [] as unknown[]),
		]);

		const m = rec(me);
		const workspaceRaw = rec(m.workspace ?? workspaces[0]);

		return {
			user: {
				id: readStr(m.id) ?? '',
				display_name: readStr(m.display_name) ?? readStr(m.email) ?? '',
				email: readStr(m.email) ?? '',
			},
			workspace: {
				id: readStr(workspaceRaw.id) ?? '',
				handle: readStr(workspaceRaw.handle) ?? '',
				name: readStr(workspaceRaw.name) ?? readStr(workspaceRaw.handle) ?? '',
				role: workspaceRole(workspaceRaw.role),
			},
			projects: projectsRaw.map(toProjectSummary),
		};
	},
};

// ---------- list_projects ----------

const listProjects: Operation<Record<string, never>, ProjectSummary[]> = {
	name: 'pyramid.project.list',
	summary: 'List the projects accessible to the authenticated user.',
	input: z.object({}),
	async run(_input, ctx): Promise<ProjectSummary[]> {
		const raw = await ctx.client.api.listProjects();
		return raw.map(toProjectSummary);
	},
};

// ---------- get_project_workflow ----------

const getProjectWorkflowInput = z.object({ project: z.string() });
type GetProjectWorkflowInput = z.infer<typeof getProjectWorkflowInput>;

const getProjectWorkflow: Operation<GetProjectWorkflowInput, Workflow> = {
	name: 'pyramid.project.workflow',
	summary:
		"Show a project's workflow: stages, statuses, labels, members, and custom-field templates.",
	input: getProjectWorkflowInput,
	meta: { cli: { positionals: ['project'] } },
	async run(input, ctx): Promise<Workflow> {
		const project = await ctx.client.resolver.resolveProject(input.project);
		return ctx.client.resolver.getWorkflow(project.id);
	},
};

// ---------- list_my_tasks ----------

// No `role`: GET /v1/me/tasks accepts `?role=` and IGNORES it server-side
// (DOC-BACKEND-CONTRACT), so offering the knob would promise a narrowing that
// never happens. Narrow with list_tasks({ owner }) / list_tasks({ reviewer }).
const listMyTasksInput = z.object({
	limit: z.number().int().min(1).max(50).optional(),
	cursor: z.string().optional(),
});
type ListMyTasksInput = z.infer<typeof listMyTasksInput>;

const DEFAULT_LIMIT = 25;

const listMyTasks: Operation<ListMyTasksInput, Page<TaskSummary>> = {
	name: 'pyramid.task.list-mine',
	summary:
		'List tasks you own or review, newest first, across projects. Returns one page with a cursor.',
	input: listMyTasksInput,
	meta: { cli: { verbAliases: ['next'] } },
	async run(input, ctx): Promise<Page<TaskSummary>> {
		const limit = input.limit ?? DEFAULT_LIMIT;
		const page = await ctx.client.api.listMyTasks({
			limit,
			cursor: input.cursor,
		});

		// Group rows by project so each project's workflow is fetched at most once
		// (the resolver caches per projectId for 60s either way).
		const items: TaskSummary[] = [];
		const wfCache = new Map<string, Workflow>();
		for (const raw of page.data) {
			const projectId = readStr(rec(raw).project_id);
			let wf: Workflow | undefined;
			if (projectId) {
				wf = wfCache.get(projectId);
				if (!wf) {
					wf = await ctx.client.resolver.getWorkflow(projectId);
					wfCache.set(projectId, wf);
				}
			}
			// Hydrate against the project workflow when known; otherwise hydrate
			// against an empty workflow (names degrade gracefully, no UUIDs invented).
			items.push(hydrateTaskSummary(raw, wf ?? EMPTY_WORKFLOW));
		}

		return {
			items,
			next_cursor: page.cursor,
			has_more: page.cursor !== null,
		};
	},
};

/** A neutral workflow used when a task row carries no resolvable project_id. */
const EMPTY_WORKFLOW: Workflow = {
	project: { id: '', handle: '', name: '', task_prefix: '', role: 'member', archived: false },
	stages: [],
	statuses: [],
	labels: [],
	members: [],
	templates: [],
};

// ============ Phase-2 shared helpers ============

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TASK_KEY_RE = /^[A-Za-z][A-Za-z0-9]*-\d+$/;

/** A resolved task reference: its UUID, owning project, and human key. */
interface TaskRef {
	id: string;
	projectId: string;
	key: string;
}

/**
 * Resolve a `task` input (a "WEB-42" human key OR a raw UUID) to its UUID +
 * owning project. The resolver owns project/status/user/label name resolution
 * but not task lookup, so this lives here (DOC-NAME-RESOLUTION r"Task"):
 *   - UUID  -> fetch the task, read its `project_id`/`key` off the raw row.
 *   - key   -> full-text search for the key, match the row whose `key` equals
 *              it (case-insensitive), then read its ids.
 * A miss throws `task_not_found`.
 */
async function resolveTaskRef(ctx: OpContext, ref: string): Promise<TaskRef> {
	const trimmed = ref.trim();

	if (UUID_RE.test(trimmed)) {
		const raw = rec(await ctx.client.api.getTask(trimmed));
		return {
			id: readStr(raw.id) ?? trimmed,
			projectId: readStr(raw.project_id) ?? '',
			key: readStr(raw.key) ?? '',
		};
	}

	if (TASK_KEY_RE.test(trimmed)) {
		const page = await ctx.client.api.searchTasks({ q: trimmed, limit: 50 });
		const needle = trimmed.toLowerCase();
		const hit = page.data.map(rec).find((r) => (readStr(r.key) ?? '').toLowerCase() === needle);
		if (hit) {
			return {
				id: readStr(hit.id) ?? '',
				projectId: readStr(hit.project_id) ?? '',
				key: readStr(hit.key) ?? trimmed,
			};
		}
		throw pyramidError('task_not_found', `No task matches "${ref}".`);
	}

	throw pyramidError('task_not_found', `"${ref}" is neither a task key (e.g. WEB-42) nor a UUID.`);
}

/**
 * Hydrate a raw task detail against its project workflow. Fetches the (cached)
 * workflow when a projectId is known; otherwise hydrates against EMPTY_WORKFLOW
 * so names degrade gracefully without inventing UUIDs.
 */
async function hydrateDetailFor(
	ctx: OpContext,
	raw: unknown,
	projectId: string
): Promise<TaskDetail> {
	const wf = projectId ? await ctx.client.resolver.getWorkflow(projectId) : EMPTY_WORKFLOW;
	return hydrateTaskDetail(raw, wf);
}

/**
 * The custom-field zod row: a field name/key + an arbitrary JSON value. Mirrors
 * CustomFieldValue in src/types.ts.
 */
const customFieldSchema = z.object({
	field: z.string(),
	value: z.unknown(),
});

/**
 * Resolve a status input that carries its stage (DOC-DESIGN-RULES r3). When both
 * `stage` and `status` are supplied, resolve the status and verify it lives in
 * the named stage (else `status_not_in_stage`). When only `stage` is supplied,
 * pick that stage's first status by position. Returns the resolved status id (or
 * undefined when neither is supplied).
 */
async function resolveStatusWithStage(
	ctx: OpContext,
	projectId: string,
	stage: string | undefined,
	status: string | undefined
): Promise<{ id: string; stage_id: string } | undefined> {
	if (status !== undefined) {
		const resolved = await ctx.client.resolver.resolveStatus(projectId, status);
		if (stage !== undefined) {
			const resolvedStage = await ctx.client.resolver.resolveStage(projectId, stage);
			if (resolved.stage_id !== resolvedStage.id) {
				throw pyramidError('status_not_in_stage', `Status "${status}" is not in stage "${stage}".`);
			}
		}
		return { id: resolved.id, stage_id: resolved.stage_id };
	}

	if (stage !== undefined) {
		// A stage with no status -> the stage's first status by position. resolveStatus
		// already implements "stage name where a status is expected -> first status".
		const resolved = await ctx.client.resolver.resolveStatus(projectId, stage);
		return { id: resolved.id, stage_id: resolved.stage_id };
	}

	return undefined;
}

/** Resolve a label-name list to label UUIDs (each via the resolver). */
async function resolveLabelIds(
	ctx: OpContext,
	projectId: string,
	labels: string[] | undefined
): Promise<string[] | undefined> {
	if (labels === undefined) return undefined;
	const ids: string[] = [];
	for (const label of labels) {
		const resolved = await ctx.client.resolver.resolveLabel(projectId, label);
		ids.push(resolved.id);
	}
	return ids;
}

/** Resolve a mentions name list to user UUIDs (each via the resolver). */
async function resolveMentionIds(
	ctx: OpContext,
	projectId: string,
	mentions: string[] | undefined
): Promise<string[] | undefined> {
	if (mentions === undefined) return undefined;
	const ids: string[] = [];
	for (const mention of mentions) {
		const resolved = await ctx.client.resolver.resolveUser(projectId, mention);
		ids.push(resolved.id);
	}
	return ids;
}

/**
 * Build a resolved create-task body from already-known projectId + names, to the
 * REAL backend contract (DOC-BACKEND-CONTRACT). Ownership is FLAT: `owner` and
 * `reviewer` resolve to top-level `owner_id`/`reviewer_id`. Custom fields are a
 * `field_values` map keyed by field UUID; labels are `label_ids`.
 */
async function buildCreateBody(
	ctx: OpContext,
	projectId: string,
	row: {
		title: string;
		description?: string;
		stage?: string;
		status?: string;
		owner?: string;
		reviewer?: string;
		labels?: string[];
		priority?: string;
		due_date?: string;
		estimate_hours?: number;
		guest_visible?: boolean;
		custom_fields?: { field: string; value?: unknown }[];
	}
): Promise<Record<string, unknown>> {
	const body: Record<string, unknown> = { title: row.title };
	if (row.description !== undefined) body.description = row.description;
	if (row.priority !== undefined) body.priority = row.priority;
	if (row.due_date !== undefined) body.due_date = row.due_date;
	if (row.estimate_hours !== undefined) body.estimate = row.estimate_hours;
	if (row.guest_visible !== undefined) body.guest_visible = row.guest_visible;

	// The status carries its stage; resolve it once (the server derives the stage).
	const resolvedStatus = await resolveStatusWithStage(ctx, projectId, row.stage, row.status);
	if (resolvedStatus !== undefined) body.status_id = resolvedStatus.id;

	// owner/reviewer -> TOP-LEVEL owner_id/reviewer_id. No stage to derive: a task
	// has one owner and one reviewer (DATATYPE-CREATE-TASK-INPUT).
	if (row.owner !== undefined) {
		body.owner_id = (await ctx.client.resolver.resolveUser(projectId, row.owner)).id;
	}
	if (row.reviewer !== undefined) {
		body.reviewer_id = (await ctx.client.resolver.resolveUser(projectId, row.reviewer)).id;
	}

	const labelIds = await resolveLabelIds(ctx, projectId, row.labels);
	if (labelIds !== undefined) body.label_ids = labelIds;

	if (row.custom_fields !== undefined) {
		body.field_values = await resolveFieldValues(ctx, projectId, row.custom_fields);
	}

	return body;
}

/**
 * Resolve custom-field names/keys to a `field_values` MAP keyed by field UUID
 * (DOC-BACKEND-CONTRACT — NOT a `custom_fields` array). A field that resolves to
 * nothing -> `field_not_found`. Value type-checking is left to the server (it
 * returns `invalid_field_value` on a mismatch).
 */
async function resolveFieldValues(
	ctx: OpContext,
	projectId: string,
	fields: { field: string; value?: unknown }[]
): Promise<Record<string, unknown>> {
	const wf = await ctx.client.resolver.getWorkflow(projectId);
	const out: Record<string, unknown> = {};
	for (const cf of fields) {
		const needle = cf.field.trim().toLowerCase();
		let def: CustomFieldDef | undefined;
		for (const t of wf.templates) {
			def = t.fields.find(
				(f) =>
					f.id === cf.field || f.key.toLowerCase() === needle || f.name.toLowerCase() === needle
			);
			if (def) break;
		}
		if (def === undefined) {
			throw pyramidError('field_not_found', `No custom field matches "${cf.field}".`);
		}
		// r7: validate the value against the field's type BEFORE sending. A `user`
		// field resolves its value (a name/email) to a user UUID.
		if (def.field_type === 'user' && typeof cf.value === 'string') {
			out[def.id] = (await ctx.client.resolver.resolveUser(projectId, cf.value)).id;
		} else {
			validateFieldValue(def, cf.value);
			out[def.id] = cf.value;
		}
	}
	return out;
}

/** A custom-field definition as carried on the cached workflow templates. */
interface CustomFieldDef {
	id: string;
	key: string;
	name: string;
	field_type: string;
	options?: string[];
}

/**
 * Validate a custom-field value against its declared `field_type` (DOC-DESIGN-RULES
 * r7) so a mismatch is a typed `invalid_field_value` BEFORE the server call rather
 * than an opaque 422. `user` fields are resolved by the caller, not validated here.
 */
function validateFieldValue(def: CustomFieldDef, value: unknown): void {
	const fail = (why: string): never => {
		throw pyramidError('invalid_field_value', `Custom field "${def.name}" ${why}.`);
	};
	switch (def.field_type) {
		case 'number':
			if (typeof value !== 'number') fail('expects a number');
			break;
		case 'checkbox':
			if (typeof value !== 'boolean') fail('expects a boolean');
			break;
		case 'date':
			if (typeof value !== 'string') fail('expects a date string (YYYY-MM-DD)');
			break;
		case 'text':
			if (typeof value !== 'string') fail('expects a string');
			break;
		case 'select':
			if (typeof value !== 'string') fail('expects a single option string');
			if (def.options && !def.options.includes(value as string)) {
				fail(`must be one of: ${def.options.join(', ')}`);
			}
			break;
		case 'multiselect':
			if (!Array.isArray(value)) fail('expects an array of option strings');
			if (def.options) {
				for (const v of value as unknown[]) {
					if (typeof v !== 'string' || !def.options.includes(v)) {
						fail(`values must each be one of: ${def.options.join(', ')}`);
					}
				}
			}
			break;
		// Unknown/other field types pass through untouched (server has final say).
	}
}

// ============ Phase-2 operations: tasks (read) ============

// ---------- task.list ----------

const taskListInput = z.object({
	project: z.string(),
	status: z.string().optional(),
	stage: z.string().optional(),
	// Owner and Reviewer — the words the product uses. There is no "assignee".
	owner: z.string().optional(),
	reviewer: z.string().optional(),
	label: z.string().optional(),
	query: z.string().optional(),
	archived: z.boolean().optional(),
	limit: z.number().int().min(1).max(50).optional(),
	cursor: z.string().optional(),
});
type TaskListInput = z.infer<typeof taskListInput>;

const taskList: Operation<TaskListInput, Page<TaskSummary>> = {
	name: 'pyramid.task.list',
	summary:
		"List a project's tasks, filtered by status/stage/owner/reviewer/label/query. Returns one page with a cursor.",
	input: taskListInput,
	meta: {
		cli: { positionals: ['project'], routes: { mine: 'pyramid.task.list-mine' } },
	},
	async run(input, ctx): Promise<Page<TaskSummary>> {
		const project = await ctx.client.resolver.resolveProject(input.project);
		const archived = input.archived ?? false;

		// Archived tasks live on a SEPARATE route (/tasks/archived) that does not take
		// the status/stage/assignee/label filters; route there when archived is asked.
		let page: { data: unknown[]; cursor: string | null };
		if (archived) {
			page = await ctx.client.api.listArchived(project.id, {
				limit: input.limit ?? DEFAULT_LIMIT,
				cursor: input.cursor,
			});
		} else {
			const statusId =
				input.status !== undefined
					? (await ctx.client.resolver.resolveStatus(project.id, input.status)).id
					: undefined;
			const stageId =
				input.stage !== undefined
					? (await ctx.client.resolver.resolveStage(project.id, input.stage)).id
					: undefined;
			const ownerId =
				input.owner !== undefined
					? (await ctx.client.resolver.resolveUser(project.id, input.owner)).id
					: undefined;
			const reviewerId =
				input.reviewer !== undefined
					? (await ctx.client.resolver.resolveUser(project.id, input.reviewer)).id
					: undefined;
			const labelId =
				input.label !== undefined
					? (await ctx.client.resolver.resolveLabel(project.id, input.label)).id
					: undefined;

			page = await ctx.client.api.listTasks(project.id, {
				status: statusId,
				stage_id: stageId,
				owner_id: ownerId,
				reviewer_id: reviewerId,
				label_id: labelId,
				q: input.query,
				limit: input.limit ?? DEFAULT_LIMIT,
				cursor: input.cursor,
			});
		}

		const wf = await ctx.client.resolver.getWorkflow(project.id);
		const items = page.data
			.map((raw) => hydrateTaskSummary(raw, wf))
			// The normal list defaults archived=false (r8) — drop archived rows unless
			// opted in; the archived route already returns only archived rows.
			.filter((t) => archived || !t.archived);

		return {
			items,
			next_cursor: page.cursor,
			has_more: page.cursor !== null,
		};
	},
};

// ---------- task.show ----------

const taskShowInput = z.object({
	task: z.string(),
	// The backend's only drill-in is `?expand`, which inlines the related owner,
	// reviewer, and label rows (DOC-BACKEND-CONTRACT). It does NOT expose
	// timeline / comments / attachments — those are separate tools (e.g. list_comments).
	expand: z.boolean().optional(),
});
type TaskShowInput = z.infer<typeof taskShowInput>;

const taskShow: Operation<TaskShowInput, TaskDetail> = {
	name: 'pyramid.task.get',
	summary:
		"Show one task's full detail by key (WEB-42) or UUID; `expand` inlines owner/reviewer/labels.",
	input: taskShowInput,
	meta: { cli: { positionals: ['task'], verbAliases: ['show'] } },
	async run(input, ctx): Promise<TaskDetail> {
		const ref = await resolveTaskRef(ctx, input.task);
		const raw = await ctx.client.api.getTask(
			ref.id,
			input.expand ? 'owner,reviewer,labels' : undefined
		);
		const projectId = readStr(rec(raw).project_id) ?? ref.projectId;
		return hydrateDetailFor(ctx, raw, projectId);
	},
};

// ============ Phase-2 operations: tasks (write) ============

// ---------- task.create ----------

const priorityEnum = z.enum(['none', 'low', 'medium', 'high', 'urgent']);

const taskCreateInput = z.object({
	project: z.string(),
	title: z.string(),
	description: z.string().optional(),
	stage: z.string().optional(),
	status: z.string().optional(),
	owner: z.string().optional(),
	reviewer: z.string().optional(),
	labels: z.array(z.string()).optional(),
	priority: priorityEnum.optional(),
	due_date: z.string().optional(),
	estimate_hours: z.number().optional(),
	guest_visible: z.boolean().optional(),
	custom_fields: z.array(customFieldSchema).optional(),
});
type TaskCreateInput = z.infer<typeof taskCreateInput>;

const taskCreate: Operation<TaskCreateInput, TaskDetail> = {
	name: 'pyramid.task.create',
	summary: 'Create a task in a project. Accepts names/keys for stage/status/owner/reviewer/labels.',
	input: taskCreateInput,
	meta: { cli: { positionals: ['title'] } },
	async run(input, ctx): Promise<TaskDetail> {
		const project = await ctx.client.resolver.resolveProject(input.project);
		const body = await buildCreateBody(ctx, project.id, input);
		const raw = await ctx.client.api.createTask(project.id, body);
		return hydrateDetailFor(ctx, raw, project.id);
	},
};

// ---------- task.bulk_create ----------

const taskBulkCreateInput = z.object({
	project: z.string(),
	template: z.string().optional(),
	defaults: z
		.object({
			stage: z.string().optional(),
			status: z.string().optional(),
			labels: z.array(z.string()).optional(),
		})
		.optional(),
	tasks: z
		.array(
			z.object({
				title: z.string(),
				description: z.string().optional(),
				stage: z.string().optional(),
				status: z.string().optional(),
				owner: z.string().optional(),
				reviewer: z.string().optional(),
				labels: z.array(z.string()).optional(),
				priority: priorityEnum.optional(),
				due_date: z.string().optional(),
				estimate_hours: z.number().optional(),
				guest_visible: z.boolean().optional(),
				custom_fields: z.array(customFieldSchema).optional(),
			})
		)
		.min(1)
		.max(100),
});
type TaskBulkCreateInput = z.infer<typeof taskBulkCreateInput>;

const taskBulkCreate: Operation<TaskBulkCreateInput, TaskDetail[]> = {
	name: 'pyramid.task.create-bulk',
	summary:
		'Bulk-create up to 100 tasks in a project from a required template (returns the created tasks).',
	input: taskBulkCreateInput,
	// CLI surfaces bulk-create on `task create` via a special-cased `--file`.
	meta: { cli: { positionals: ['project'], verbAliases: ['bulk'], fileInput: 'tasks' } },
	async run(input, ctx): Promise<TaskDetail[]> {
		const project = await ctx.client.resolver.resolveProject(input.project);
		const defaults = input.defaults ?? {};

		// The backend requires a TOP-LEVEL template_id; resolve the named template by
		// name/key against the project's task-schema. No template named -> a clear
		// validation_failed (a template is required).
		if (input.template === undefined) {
			throw pyramidError(
				'validation_failed',
				'Bulk create requires a `template` (the task-schema template to instantiate).'
			);
		}
		const templateId = await resolveTemplateId(ctx, project.id, input.template);

		// Resolve EVERY row up front so a resolution failure fails fast (before any
		// server write).
		const rows: Record<string, unknown>[] = [];
		for (const row of input.tasks) {
			rows.push(
				await buildCreateBody(ctx, project.id, {
					...row,
					stage: row.stage ?? defaults.stage,
					status: row.status ?? defaults.status,
					labels: row.labels ?? defaults.labels,
				})
			);
		}

		const raw = rec(
			await ctx.client.api.bulkCreate({
				project_id: project.id,
				template_id: templateId,
				tasks: rows,
			})
		);
		const created = Array.isArray(raw.created) ? raw.created : [];
		const wf = await ctx.client.resolver.getWorkflow(project.id);
		return created.map((r) => hydrateTaskDetail(r, wf));
	},
};

/**
 * Resolve a template name/key/id to a template UUID via the project's task-schema
 * (carried on the cached workflow's `templates`). A miss -> validation_failed
 * with the available template names.
 */
async function resolveTemplateId(
	ctx: OpContext,
	projectId: string,
	template: string
): Promise<string> {
	const wf = await ctx.client.resolver.getWorkflow(projectId);
	const needle = template.trim().toLowerCase();
	const match = wf.templates.find((t) => t.id === template || t.name.toLowerCase() === needle);
	if (match) return match.id;
	throw pyramidError('validation_failed', `No task template matches "${template}".`, {
		candidates: wf.templates.map((t) => t.name),
	});
}

// ---------- task.update ----------

const taskUpdateInput = z.object({
	task: z.string(),
	title: z.string().optional(),
	description: z.string().nullable().optional(),
	priority: z.string().optional(),
	due_date: z.string().nullable().optional(),
	start_date: z.string().nullable().optional(),
	estimate: z.number().optional(),
	guest_visible: z.boolean().optional(),
	owner: z.string().nullable().optional(),
	reviewer: z.string().nullable().optional(),
	add_labels: z.array(z.string()).optional(),
	remove_labels: z.array(z.string()).optional(),
	custom_fields: z.array(customFieldSchema).optional(),
});
type TaskUpdateInput = z.infer<typeof taskUpdateInput>;

const taskUpdate: Operation<TaskUpdateInput, TaskDetail> = {
	name: 'pyramid.task.update',
	summary:
		'Update a task, including its owner/reviewer (pass null to clear). Labels and custom fields fan out to their endpoints.',
	input: taskUpdateInput,
	meta: { cli: { positionals: ['task'] } },
	async run(input, ctx): Promise<TaskDetail> {
		const ref = await resolveTaskRef(ctx, input.task);
		const projectId = ref.projectId;

		// 1) THE PATCH (DOC-BACKEND-CONTRACT): content fields PLUS owner/reviewer,
		// which are top-level nullable columns now. One write, one If-Match
		// (read-first, added by the client) — so a reassignment can no longer land
		// while the content change is rejected. Labels and field_values still are
		// NOT accepted here.
		const patch: Record<string, unknown> = {};
		if (input.title !== undefined) patch.title = input.title;
		if (input.description !== undefined) patch.description = input.description;
		if (input.priority !== undefined) patch.priority = input.priority;
		if (input.due_date !== undefined) patch.due_date = input.due_date;
		if (input.start_date !== undefined) patch.start_date = input.start_date;
		if (input.estimate !== undefined) patch.estimate = input.estimate;
		if (input.guest_visible !== undefined) patch.guest_visible = input.guest_visible;

		// owner/reviewer: a name resolves to a UUID; an explicit null CLEARS the
		// field (and must survive as null, not be dropped as "unset").
		if (input.owner !== undefined) {
			patch.owner_id =
				input.owner === null
					? null
					: (await ctx.client.resolver.resolveUser(projectId, input.owner)).id;
		}
		if (input.reviewer !== undefined) {
			patch.reviewer_id =
				input.reviewer === null
					? null
					: (await ctx.client.resolver.resolveUser(projectId, input.reviewer)).id;
		}

		if (Object.keys(patch).length > 0) {
			await failingSubUpdate('content', () => ctx.client.api.updateTask(ref.id, patch));
		}

		// 2) FAN-OUT (best-effort, after the PATCH). Labels and custom fields still
		// have dedicated endpoints; a failure surfaces WHICH sub-update failed.

		// add_labels / remove_labels -> POST / DELETE /tasks/{id}/labels[/{labelId}].
		const addLabelIds = await resolveLabelIds(ctx, projectId, input.add_labels);
		for (const labelId of addLabelIds ?? []) {
			await failingSubUpdate('add_label', () => ctx.client.api.addTaskLabel(ref.id, labelId));
		}
		const removeLabelIds = await resolveLabelIds(ctx, projectId, input.remove_labels);
		for (const labelId of removeLabelIds ?? []) {
			await failingSubUpdate('remove_label', () => ctx.client.api.removeTaskLabel(ref.id, labelId));
		}

		// custom_fields -> PATCH /tasks/{id}/field-values { field_values: {...} }.
		if (input.custom_fields !== undefined) {
			const fieldValues = await resolveFieldValues(ctx, projectId, input.custom_fields);
			await failingSubUpdate('field_values', () =>
				ctx.client.api.setFieldValues(ref.id, { field_values: fieldValues })
			);
		}

		// 3) Re-fetch + hydrate the final task state.
		const raw = await ctx.client.api.getTask(ref.id);
		return hydrateDetailFor(ctx, raw, projectId);
	},
};

/**
 * Run one sub-update of the update_task fan-out, surfacing WHICH part failed. A
 * thrown MagicError is re-wrapped (preserving its code) with a `(<which>)` prefix so
 * the caller can see which dedicated endpoint rejected.
 */
async function failingSubUpdate<T>(which: string, fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (err) {
		if (err instanceof MagicError) {
			throw new MagicError(err.code, `update_task ${which} failed: ${err.message}`, {
				product: err.product,
				...(err.hint !== undefined ? { hint: err.hint } : {}),
				...(err.candidates !== undefined ? { candidates: err.candidates } : {}),
				...(err.details !== undefined ? { details: err.details } : {}),
			});
		}
		throw err;
	}
}

// ---------- task.move ----------

const taskMoveInput = z.object({
	task: z.string(),
	status: z.string(),
	after_task: z.string().optional(),
	before_task: z.string().optional(),
});
type TaskMoveInput = z.infer<typeof taskMoveInput>;

const taskMove: Operation<TaskMoveInput, TaskDetail> = {
	name: 'pyramid.task.move',
	summary:
		'Move a task to a target status (carries its stage), optionally positioned by neighbor key.',
	input: taskMoveInput,
	meta: { cli: { positionals: ['task'] } },
	async run(input, ctx): Promise<TaskDetail> {
		// Positions are server-generated — pass neighbor ids, never a fractional key.
		// after + before are mutually exclusive.
		if (input.after_task !== undefined && input.before_task !== undefined) {
			throw pyramidError('validation_failed', 'Pass at most one of after_task / before_task.');
		}

		const ref = await resolveTaskRef(ctx, input.task);
		const status = await ctx.client.resolver.resolveStatus(ref.projectId, input.status);

		// Wire keys are before_id / after_id (DOC-BACKEND-CONTRACT), not *_task_id.
		const body: Record<string, unknown> = { status_id: status.id };
		if (input.after_task !== undefined) {
			body.after_id = (await resolveTaskRef(ctx, input.after_task)).id;
		}
		if (input.before_task !== undefined) {
			body.before_id = (await resolveTaskRef(ctx, input.before_task)).id;
		}

		// The response is an ENVELOPE { task, previous } — hydrate raw.task, never the
		// whole envelope.
		const raw = rec(await ctx.client.api.moveTask(ref.id, body));
		return hydrateDetailFor(ctx, raw.task, ref.projectId);
	},
};

// ---------- task.archive ----------

const taskArchiveInput = z.object({
	task: z.string(),
	// The CLI archives by default; `--unarchive` sets false.
	archived: z.boolean().default(true),
});
type TaskArchiveInput = z.infer<typeof taskArchiveInput>;

const taskArchive: Operation<TaskArchiveInput, TaskDetail> = {
	name: 'pyramid.task.archive',
	summary: 'Soft-archive (or unarchive) a task. Reversible — not destructive-gated.',
	input: taskArchiveInput,
	meta: { cli: { positionals: ['task'], presets: { unarchive: { archived: false } } } },
	async run(input, ctx): Promise<TaskDetail> {
		const ref = await resolveTaskRef(ctx, input.task);
		const raw = input.archived
			? await ctx.client.api.archiveTask(ref.id)
			: await ctx.client.api.unarchiveTask(ref.id);
		return hydrateDetailFor(ctx, raw, ref.projectId);
	},
};

// ---------- task.delete ----------

const taskDeleteInput = z.object({ task: z.string() });
type TaskDeleteInput = z.infer<typeof taskDeleteInput>;

const taskDelete: Operation<TaskDeleteInput, { id: string; key: string; deleted: true }> = {
	name: 'pyramid.task.delete',
	summary:
		'Hard-delete a task. Requires MAGIC_ALLOW_DESTRUCTIVE=1 (otherwise destructive_action_disabled).',
	input: taskDeleteInput,
	meta: {
		destructive: true,
		cli: { positionals: ['task'] },
	},
	// meta.destructive is the gate: the kit's CLI runner and MCP callTool enforce it.
	async run(input, ctx): Promise<{ id: string; key: string; deleted: true }> {
		const ref = await resolveTaskRef(ctx, input.task);
		await ctx.client.api.deleteTask(ref.id, true);
		return { id: ref.id, key: ref.key, deleted: true };
	},
};

// ============ Phase-2 operations: comments ============

// ---------- comment.add ----------

const commentAddInput = z.object({
	task: z.string(),
	content: z.string(),
	stage: z.string().optional(),
	mentions: z.array(z.string()).optional(),
});
type CommentAddInput = z.infer<typeof commentAddInput>;

const commentAdd: Operation<CommentAddInput, TaskComment> = {
	name: 'pyramid.task.comment',
	summary: "Add a stage-scoped comment to a task (defaults to the task's current stage).",
	input: commentAddInput,
	meta: {
		cli: { positionals: ['task', 'content'] },
	},
	async run(input, ctx): Promise<TaskComment> {
		const ref = await resolveTaskRef(ctx, input.task);
		const projectId = ref.projectId;

		// Comments are stage-scoped (r4). An explicit stage resolves to its id;
		// otherwise default to the task's current stage (read from the task row).
		let stageId: string | undefined;
		if (input.stage !== undefined) {
			stageId = (await ctx.client.resolver.resolveStage(projectId, input.stage)).id;
		} else {
			stageId = await currentStageId(ctx, ref);
		}

		const mentionIds = await resolveMentionIds(ctx, projectId, input.mentions);

		// Wire field is content + stage_id + mention_user_ids (DOC-BACKEND-CONTRACT).
		const body: Record<string, unknown> = { content: input.content };
		if (stageId !== undefined) body.stage_id = stageId;
		if (mentionIds !== undefined) body.mention_user_ids = mentionIds;

		const raw = await ctx.client.api.addComment(ref.id, body);
		const wf = projectId ? await ctx.client.resolver.getWorkflow(projectId) : EMPTY_WORKFLOW;
		return hydrateComment(raw, wf);
	},
};

/** The task's current stage id, derived from its status via the workflow. */
async function currentStageId(ctx: OpContext, ref: TaskRef): Promise<string | undefined> {
	if (!ref.projectId) return undefined;
	const raw = rec(await ctx.client.api.getTask(ref.id));
	const statusId = readStr(raw.status_id);
	if (statusId) {
		const wf = await ctx.client.resolver.getWorkflow(ref.projectId);
		const status = wf.statuses.find((s) => s.id === statusId);
		if (status) return status.stage_id;
	}
	return readStr(raw.stage_id);
}

// ---------- comment.reply ----------

const commentReplyInput = z.object({
	comment_id: z.string(),
	content: z.string(),
	mentions: z.array(z.string()).optional(),
});
type CommentReplyInput = z.infer<typeof commentReplyInput>;

const commentReply: Operation<CommentReplyInput, TaskComment> = {
	name: 'pyramid.comment.reply',
	summary: 'Reply to a ROOT comment (one level only; replying to a reply -> reply_depth_exceeded).',
	input: commentReplyInput,
	meta: {
		cli: { positionals: ['comment_id', 'content'] },
	},
	async run(input, ctx): Promise<TaskComment> {
		// Replies are one level deep (r5). Validate the target is a ROOT comment
		// BEFORE the call: a non-null parent_id / thread_root_id means it is itself a
		// reply -> reply_depth_exceeded, with no write attempted.
		const target = rec(await ctx.client.api.getComment(input.comment_id));
		const parentId = readStr(target.parent_id);
		const threadRootId = readStr(target.thread_root_id);
		const selfId = readStr(target.id);
		// A reply has a non-empty parent_id, or a thread_root_id pointing at another
		// comment. A root has neither (or thread_root_id === its own id).
		if (parentId !== undefined || (threadRootId !== undefined && threadRootId !== selfId)) {
			throw pyramidError(
				'reply_depth_exceeded',
				'Replies are one level deep — reply to the root comment instead.'
			);
		}

		const taskId = readStr(target.task_id);
		const projectId = taskId ? (await resolveTaskRef(ctx, taskId)).projectId : '';
		const mentionIds = await resolveMentionIds(ctx, projectId, input.mentions);

		// Wire field is content + mention_user_ids (no stage_id — inherits parent's).
		const body: Record<string, unknown> = { content: input.content };
		if (mentionIds !== undefined) body.mention_user_ids = mentionIds;

		const raw = await ctx.client.api.replyComment(input.comment_id, body);
		const wf = projectId ? await ctx.client.resolver.getWorkflow(projectId) : EMPTY_WORKFLOW;
		return hydrateComment(raw, wf);
	},
};

// ---------- search_tasks ----------

const searchTasksInput = z.object({
	query: z.string(),
	limit: z.number().int().min(1).max(50).optional(),
});
type SearchTasksInput = z.infer<typeof searchTasksInput>;

const searchTasks: Operation<SearchTasksInput, Page<TaskSummary>> = {
	name: 'pyramid.task.search',
	summary: 'Full-text search tasks across the workspace by title/key/content. Returns one page.',
	input: searchTasksInput,
	meta: { cli: { positionals: ['query'] } },
	async run(input, ctx): Promise<Page<TaskSummary>> {
		const page = await ctx.client.api.searchTasks({
			q: input.query,
			limit: input.limit ?? DEFAULT_LIMIT,
		});
		// Results span projects — hydrate each against its OWN project workflow,
		// caching per project so a page touches each workflow at most once.
		const wfCache = new Map<string, Workflow>();
		const items: TaskSummary[] = [];
		for (const raw of page.data) {
			const pid = readStr(rec(raw).project_id) ?? '';
			let wf = wfCache.get(pid);
			if (wf === undefined) {
				wf = pid ? await ctx.client.resolver.getWorkflow(pid) : EMPTY_WORKFLOW;
				wfCache.set(pid, wf);
			}
			items.push(hydrateTaskSummary(raw, wf));
		}
		return { items, next_cursor: page.cursor, has_more: page.cursor !== null };
	},
};

// ---------- list_comments ----------

const listCommentsInput = z.object({
	task: z.string(),
	// Stage-scoped (r4): defaults to the task's CURRENT stage; pass "all" to list
	// comments across every stage, or a stage name/key to scope to that stage.
	stage: z.string().optional(),
	limit: z.number().int().min(1).max(50).optional(),
	cursor: z.string().optional(),
});
type ListCommentsInput = z.infer<typeof listCommentsInput>;

const listComments: Operation<ListCommentsInput, Page<TaskComment>> = {
	name: 'pyramid.comment.list',
	summary:
		'List a task\'s comments, oldest first. Defaults to the task\'s current stage; `stage: "all"` lists every stage.',
	input: listCommentsInput,
	meta: { cli: { positionals: ['task'] } },
	async run(input, ctx): Promise<Page<TaskComment>> {
		const ref = await resolveTaskRef(ctx, input.task);
		// Default to the current stage (r4); "all" is the explicit all-stages mode.
		let stageId: string | undefined;
		if (input.stage === undefined) {
			stageId = await currentStageId(ctx, ref);
		} else if (input.stage.trim().toLowerCase() === 'all') {
			stageId = undefined;
		} else {
			stageId = (await ctx.client.resolver.resolveStage(ref.projectId, input.stage)).id;
		}
		const page = await ctx.client.api.listComments(ref.id, {
			stage_id: stageId,
			limit: input.limit ?? DEFAULT_LIMIT,
			cursor: input.cursor,
		});
		const wf = ref.projectId
			? await ctx.client.resolver.getWorkflow(ref.projectId)
			: EMPTY_WORKFLOW;
		const items = page.data.map((raw) => hydrateComment(raw, wf));
		return { items, next_cursor: page.cursor, has_more: page.cursor !== null };
	},
};

// ---------- get_task_timeline ----------

const TIMELINE_DEFAULT_LIMIT = 50;
const TIMELINE_MAX_LIMIT = 200;

const taskTimelineInput = z.object({
	task: z.string(),
	/** Narrow to one kind, e.g. "owner_changed" / "status_changed". */
	event_type: z.string().optional(),
	limit: z.number().int().min(1).max(TIMELINE_MAX_LIMIT).optional(),
	cursor: z.string().optional(),
});
type TaskTimelineInput = z.infer<typeof taskTimelineInput>;

const taskTimeline: Operation<TaskTimelineInput, Page<TimelineEvent>> = {
	name: 'pyramid.task.timeline',
	summary:
		"A task's history (who changed what, when), OLDEST first. Optionally filter to one event_type, e.g. owner_changed.",
	input: taskTimelineInput,
	meta: { cli: { positionals: ['task'] } },
	async run(input, ctx): Promise<Page<TimelineEvent>> {
		const ref = await resolveTaskRef(ctx, input.task);
		const page = await ctx.client.api.getTaskTimeline(ref.id, {
			limit: input.limit ?? TIMELINE_DEFAULT_LIMIT,
			cursor: input.cursor,
			event_type: input.event_type,
		});
		// Only the actor is joined to a name; the per-event values stay raw because
		// their shape is event_type-dependent (DATATYPE-TIMELINE-EVENT).
		const wf = ref.projectId
			? await ctx.client.resolver.getWorkflow(ref.projectId)
			: EMPTY_WORKFLOW;
		const items = page.data.map((raw) => hydrateTimelineEvent(raw, wf));
		return { items, next_cursor: page.cursor, has_more: page.cursor !== null };
	},
};

// ============ Registry ============

/** Every operation, in surface order (Phase-1 read-only, then Phase-2). */
export const operations: Operation[] = [
	whoami as Operation,
	listProjects as Operation,
	getProjectWorkflow as Operation,
	listMyTasks as Operation,
	taskList as Operation,
	taskShow as Operation,
	taskTimeline as Operation,
	searchTasks as Operation,
	taskCreate as Operation,
	taskBulkCreate as Operation,
	taskUpdate as Operation,
	taskMove as Operation,
	taskArchive as Operation,
	taskDelete as Operation,
	commentAdd as Operation,
	commentReply as Operation,
	listComments as Operation,
];

/** Lookup by MCP tool name. */
export const operationsByName: Map<string, Operation> = new Map(operations.map((o) => [o.name, o]));
