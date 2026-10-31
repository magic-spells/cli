// Shared fakes for kit tests: a demo product, an in-memory store, captured IO.

import { z } from 'zod';

import type { CredentialStore } from '../src/keychain.js';
import type { Operation, ProductModule } from '../src/operation.js';
import type { RenderIO } from '../src/render.js';

export function memoryStore(initial: Record<string, string> = {}): CredentialStore & {
	items: Record<string, string>;
} {
	const items = { ...initial };
	return {
		items,
		backend: 'file',
		async get(item) {
			return items[item] ?? null;
		},
		async set(item, secret) {
			items[item] = secret;
		},
		async delete(item) {
			delete items[item];
		},
		async list() {
			return Object.keys(items);
		},
	};
}

export function captureIO(tty = false): RenderIO & { stdout: string; stderr: string } {
	const io = { stdout: '', stderr: '' } as RenderIO & { stdout: string; stderr: string };
	io.out = (t) => void (io.stdout += t);
	io.err = (t) => void (io.stderr += t);
	io.isTTY = () => tty;
	return io;
}

export interface DemoClient {
	key: string;
	apiUrl: string;
	calls: { op: string; input: unknown }[];
}

const calls: DemoClient['calls'] = [];

const record =
	(name: string, out?: (input: any) => unknown) =>
	async (input: any): Promise<unknown> => {
		calls.push({ op: name, input });
		return out ? out(input) : { ok: true, input };
	};

export const demoOps: Operation<any, unknown, DemoClient>[] = [
	{
		name: 'demo.whoami',
		summary: 'Who am I',
		input: z.object({}),
		run: async (_i, ctx) => ({ key_tail: ctx.client.key.slice(-4), url: ctx.client.apiUrl }),
	},
	{
		name: 'demo.widget.list',
		summary: 'List widgets',
		input: z.object({
			project: z.string().optional(),
			limit: z.number().int().optional(),
			cursor: z.string().optional(),
		}),
		meta: { cli: { verbAliases: ['ls'], routes: { mine: 'demo.widget.list-mine' } } },
		run: record('list', () => ({ items: [{ id: 'w1', name: 'One' }], next_cursor: 'c2' })),
	},
	{
		name: 'demo.widget.list-mine',
		summary: 'My widgets',
		input: z.object({ limit: z.number().int().optional() }),
		meta: { cli: { verbAliases: ['next'] } },
		run: record('mine'),
	},
	{
		name: 'demo.widget.move',
		summary: 'Move a widget',
		input: z.object({
			widget: z.string(),
			status: z.string().optional(),
			after_widget: z.string().optional(),
			labels: z.array(z.string()).optional(),
			urgent: z.boolean().optional(),
			color: z.enum(['red', 'blue']).optional(),
			project: z.string().optional(),
		}),
		meta: { cli: { positionals: ['widget'], aliases: { s: 'status' } } },
		run: record('move'),
	},
	{
		name: 'demo.widget.archive',
		summary: 'Archive a widget',
		input: z.object({ widget: z.string(), archived: z.boolean().default(true) }),
		meta: { cli: { positionals: ['widget'], presets: { unarchive: { archived: false } } } },
		run: record('archive'),
	},
	{
		name: 'demo.widget.bulk',
		summary: 'Create widgets',
		input: z.object({ rows: z.array(z.object({ title: z.string() })) }),
		meta: { cli: { fileInput: 'rows' } },
		run: record('bulk'),
	},
	{
		name: 'demo.widget.delete',
		summary: 'Delete a widget',
		input: z.object({ widget: z.string() }),
		meta: { destructive: true, cli: { positionals: ['widget'] } },
		run: record('delete'),
	},
	{
		name: 'demo.local.check',
		summary: 'Local only',
		input: z.object({}),
		meta: { requiresSession: false },
		run: async (_i, ctx) => ({ session: ctx.session }),
	},
];

export const demoProduct: ProductModule<DemoClient> = {
	id: 'demo',
	title: 'Demo',
	credential: 'dmk_',
	apiUrl: 'https://api.demo.example',
	keyHelp: 'Demo → Settings → Keys',
	globalFlags: ['project'],
	load: async () => demoOps,
	client: (session, config) => ({
		key: session.key,
		apiUrl: config.products.demo!.apiUrl,
		calls,
	}),
};

export function demoCalls(): DemoClient['calls'] {
	return calls;
}

export const DEMO_KEY = 'dmk_abc123_secretvalue';
