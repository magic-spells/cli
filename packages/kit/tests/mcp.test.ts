// The MCP builder: tool names, destructive gate, error envelopes (no transport).

import { describe, expect, it } from 'vitest';

import { loadCliConfig } from '../src/config.js';
import { callTool, createMcpServer, toolInputShape } from '../src/mcp.js';
import { TtlCache } from '../src/cache.js';
import type { OpContext } from '../src/operation.js';
import { DEMO_KEY, demoOps, demoProduct, type DemoClient } from './helpers.js';

function ctx(allowDestructive: boolean): OpContext<DemoClient> {
	const config = loadCliConfig({
		products: [{ id: 'demo', apiUrl: demoProduct.apiUrl }],
		env: allowDestructive ? { MAGIC_ALLOW_DESTRUCTIVE: '1' } : {},
	});
	const session = { product: 'demo', key: DEMO_KEY, source: 'env' as const };
	return {
		config,
		session,
		client: demoProduct.client(session, config),
		cache: new TtlCache(1000),
		signal: new AbortController().signal,
	};
}

const del = demoOps.find((o) => o.name === 'demo.widget.delete')!;
const move = demoOps.find((o) => o.name === 'demo.widget.move')!;

describe('MCP tools', () => {
	it('registers every operation as product_noun_verb', () => {
		const server = createMcpServer({
			name: 'magic',
			version: '0.0.0',
			products: [{ module: demoProduct, operations: demoOps, ctx: ctx(false) }],
		});
		const tools = Object.keys(
			(server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools
		);
		expect(tools).toContain('demo_widget_list_mine');
		expect(tools).toContain('demo_whoami');
		expect(tools).toHaveLength(demoOps.length);
	});

	it('destructive tools gain a yes input', () => {
		expect(Object.keys(toolInputShape(del))).toEqual(['widget', 'yes']);
		expect(Object.keys(toolInputShape(move))).not.toContain('yes');
	});

	it('a destructive call needs yes:true AND MAGIC_ALLOW_DESTRUCTIVE=1', async () => {
		for (const [allow, yes] of [
			[false, true],
			[true, false],
			[false, false],
		] as const) {
			const r = await callTool('demo', del, ctx(allow), { widget: 'W-1', yes });
			expect(r.isError).toBe(true);
			expect(JSON.parse(r.content[0]!.text).error.code).toBe('destructive_action_disabled');
		}
		const ok = await callTool('demo', del, ctx(true), { widget: 'W-1', yes: true });
		expect(ok.isError).toBeUndefined();
		expect(JSON.parse(ok.content[0]!.text).input).toEqual({ widget: 'W-1' });
	});

	it('bad input and thrown errors come back as product envelopes', async () => {
		const r = await callTool('demo', move, ctx(false), {});
		expect(r.isError).toBe(true);
		expect(JSON.parse(r.content[0]!.text).error.product).toBe('demo');
	});
});
