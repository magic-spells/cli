// Pyramid on the kit's MCP builder: tools are pyramid_*, resources and prompts carry
// the prefix, and the instructions text rides along (FEATURE-PYRAMID-MOVE).

import { describe, expect, it } from 'vitest';

import { createMcpServer, loadCliConfig } from '@magic-spells/kit';

import pyramid from '../src/index.js';

describe('pyramid MCP surface', () => {
	it('registers pyramid_* tools, prefixed resources and the pyramid_doctor prompt', async () => {
		const config = loadCliConfig({
			products: [{ id: 'pyramid', apiUrl: pyramid.apiUrl }],
			env: {},
		});
		const session = { product: 'pyramid', key: 'pyk_x_y', source: 'env' as const };
		const ctx = {
			config,
			session,
			client: pyramid.client(session, config),
			signal: new AbortController().signal,
		};
		const server = createMcpServer({
			name: 'magic',
			version: '9.8.7',
			products: [{ module: pyramid, operations: await pyramid.load(), context: async () => ctx }],
		});
		const internals = server as unknown as {
			_registeredTools: Record<string, unknown>;
			_registeredPrompts: Record<string, unknown>;
			_registeredResources: Record<string, unknown>;
			_registeredResourceTemplates: Record<string, unknown>;
			server: { _instructions?: string };
		};
		const tools = Object.keys(internals._registeredTools).sort();
		expect(tools).toContain('pyramid_task_list_mine');
		expect(tools).toContain('pyramid_task_comment');
		expect(tools).toContain('pyramid_whoami');
		expect(tools.every((t) => t.startsWith('pyramid_'))).toBe(true);
		expect(tools).toHaveLength(17);
		expect(Object.keys(internals._registeredPrompts)).toEqual(['pyramid_doctor']);
		expect(Object.keys(internals._registeredResources).sort()).toEqual([
			'pyramid://me',
			'pyramid://projects',
		]);
		expect(Object.keys(internals._registeredResourceTemplates)).toEqual([
			'pyramid_project_workflow',
		]);
		expect(internals.server._instructions).toMatch(/^Pyramid MCP v9\.8\.7 — /);
	});
});
