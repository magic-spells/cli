// FILE-RESOURCES — MCP resource skin.
//
// Read-only resources, each a view over an operation so a read returns exactly what
// the equivalent tool would:
//   - pyramid://me                         -> pyramid.whoami
//   - pyramid://projects                   -> pyramid.project.list
//   - pyramid://projects/{handle}/workflow -> pyramid.project.workflow
// Resource names carry the `pyramid_` prefix so they never collide in `magic mcp`.

import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { toPyramidError } from '../errors.js';
import { operationsByName } from '../operations/index.js';
import type { ContextSource } from '@magic-spells/kit';

import type { Operation } from '../operations/index.js';

/** An operation by name; the registry always carries these three. */
function op(name: string): Operation {
	const found = operationsByName.get(name);
	if (!found) throw new Error(`missing operation ${name}`);
	return found;
}

/**
 * Run an operation (with empty input) and serialize it; on error return the same
 * `{ error: { code, message, hint?, candidates? } }` envelope the tools use, so a
 * resource read never throws raw across the wire.
 */
async function renderOp(op: Operation, context: ContextSource): Promise<string> {
	try {
		const input = op.input.parse({});
		const result = await op.run(input, await context());
		return JSON.stringify(result, null, 2);
	} catch (err) {
		return JSON.stringify({ error: toPyramidError(err).toJSON() }, null, 2);
	}
}

/** Register `pyramid://me` and `pyramid://projects` as read-only resources. */
export function registerResources(server: McpServer, context: ContextSource): void {
	server.registerResource(
		'pyramid_me',
		'pyramid://me',
		{
			title: 'Pyramid identity',
			description: 'The authenticated user, their workspace, and accessible projects (whoami).',
			mimeType: 'application/json',
		},
		async (uri: URL) => {
			const text = await renderOp(op('pyramid.whoami'), context);
			return {
				contents: [{ uri: uri.href, mimeType: 'application/json', text }],
			};
		}
	);

	server.registerResource(
		'pyramid_projects',
		'pyramid://projects',
		{
			title: 'Pyramid projects',
			description: 'The projects accessible to the authenticated user.',
			mimeType: 'application/json',
		},
		async (uri: URL) => {
			const text = await renderOp(op('pyramid.project.list'), context);
			return {
				contents: [{ uri: uri.href, mimeType: 'application/json', text }],
			};
		}
	);

	// pyramid://projects/{handle}/workflow -> the project's assembled workflow (stages,
	// statuses, labels, members, field templates) the model loads to resolve names.
	server.registerResource(
		'pyramid_project_workflow',
		new ResourceTemplate('pyramid://projects/{handle}/workflow', { list: undefined }),
		{
			title: 'Project workflow',
			description: "A project's stages, statuses, labels, members, and field templates, by handle.",
			mimeType: 'application/json',
		},
		async (uri: URL, variables: Record<string, string | string[]>) => {
			const raw = variables.handle;
			const handle = Array.isArray(raw) ? raw[0] : raw;
			const workflow = op('pyramid.project.workflow');
			let text: string;
			if (handle) {
				try {
					const result = await workflow.run(
						workflow.input.parse({ project: handle }),
						await context()
					);
					text = JSON.stringify(result, null, 2);
				} catch (err) {
					text = JSON.stringify({ error: toPyramidError(err).toJSON() }, null, 2);
				}
			} else {
				text = JSON.stringify(
					{
						error: {
							code: 'validation_failed',
							message: 'missing project handle',
							product: 'pyramid',
						},
					},
					null,
					2
				);
			}
			return {
				contents: [{ uri: uri.href, mimeType: 'application/json', text }],
			};
		}
	);
}
