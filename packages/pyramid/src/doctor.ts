// Pyramid's doctor checks (COMPONENT-PYRAMID-PACKAGE "doctor"), from pyramid-cli's
// bin doctor path: the key authenticates (user, workspace, projects), then the
// first project's workflow endpoint answers. Run by the kit's runDoctorChecks.

import { readField, readStr, type DoctorCheck } from '@magic-spells/kit';

import type { PyramidApi } from './operations/index.js';

export const doctorChecks: DoctorCheck<PyramidApi>[] = [
	{
		name: 'pyramid auth',
		async run(ctx) {
			const [me, projects, workspaces] = await Promise.all([
				ctx.client.api.getMe(),
				ctx.client.api.listProjects(),
				ctx.client.api.listWorkspaces().catch(() => [] as unknown[]),
			]);
			const name =
				readStr(readField(me, 'display_name')) ??
				readStr(readField(me, 'email')) ??
				'(unknown user)';
			const email = readStr(readField(me, 'email'));
			const ws = readField(me, 'workspace') ?? workspaces[0];
			const workspace =
				readStr(readField(ws, 'name')) ?? readStr(readField(ws, 'handle')) ?? '(workspace)';
			const names = projects
				.map((p) => readStr(readField(p, 'name')) ?? readStr(readField(p, 'handle')))
				.filter((n): n is string => n !== undefined);
			const user = email ? `${name} <${email}>` : name;
			return {
				ok: true,
				detail:
					`Authenticated as ${user} · workspace ${workspace} · ` +
					`${names.length} project${names.length === 1 ? '' : 's'}` +
					(names.length ? `: ${names.join(', ')}` : ''),
				data: {
					user: { name, email: email ?? null },
					workspace: { name: workspace },
					projects: names,
				},
			};
		},
	},
	{
		name: 'pyramid workflow',
		async run(ctx) {
			const projects = await ctx.client.api.listProjects();
			const id = readStr(readField(projects[0], 'id'));
			if (!id) return { ok: true, detail: 'No projects; workflow endpoint not checked.' };
			await ctx.client.resolver.getWorkflow(id);
			return { ok: true, detail: 'Workflow endpoint: OK.' };
		},
	},
];
