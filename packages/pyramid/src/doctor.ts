// Pyramid's doctor checks (COMPONENT-PYRAMID-PACKAGE "doctor"), from pyramid-cli's
// bin doctor path: the key authenticates (the `pyramid.whoami` operation), then the
// first project's workflow endpoint answers. Run by the kit's runDoctorChecks.

import { readField, readStr, type DoctorCheck } from '@magic-spells/kit';

import type { PyramidApi } from './operations/index.js';
import type { WhoAmI } from './types.js';

// The operations graph loads only when a check runs, as for every other command.
const whoamiOp = async () =>
	(await import('./operations/index.js')).operationsByName.get('pyramid.whoami')!;

export const doctorChecks: DoctorCheck<PyramidApi>[] = [
	{
		name: 'pyramid auth',
		async run(ctx) {
			const me = (await (await whoamiOp()).run({}, ctx)) as WhoAmI;
			const name = me.user.display_name || '(unknown user)';
			const user = me.user.email ? `${name} <${me.user.email}>` : name;
			const workspace = me.workspace.name || '(workspace)';
			const names = me.projects.map((p) => p.name || p.handle).filter((n) => n.length > 0);
			return {
				ok: true,
				detail:
					`Authenticated as ${user} · workspace ${workspace} · ` +
					`${names.length} project${names.length === 1 ? '' : 's'}` +
					(names.length ? `: ${names.join(', ')}` : ''),
				data: {
					user: { name, email: me.user.email || null },
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
