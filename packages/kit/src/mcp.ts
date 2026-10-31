// The MCP server builder (COMPONENT-KIT "mcp", used by COMPONENT-MCP-AGGREGATOR),
// from pyramid-cli's src/mcp/server.ts, generalised to many products.
//
// Each operation becomes a tool named `product_noun_verb` with its summary as the
// description and its zod shape as the input schema. Destructive operations take an
// extra `yes` input and run only with `yes: true` AND MAGIC_ALLOW_DESTRUCTIVE=1.
// Handlers never throw to the transport: errors return as `isError` envelopes.
// stdout belongs to the transport; nothing here writes to it.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z, type ZodRawShape } from 'zod';

import { destructiveDisabled } from './cli.js';
import { MagicError, toMagicError, toToolError } from './errors.js';
import {
	onSurface,
	toolName,
	type OpContext,
	type Operation,
	type ProductModule,
} from './operation.js';

export interface McpProduct<C = any> {
	module: ProductModule<C>;
	operations: Operation<any, unknown, C>[];
	ctx: OpContext<C>;
}

export interface McpServerOptions {
	name: string;
	version: string;
	products: McpProduct[];
}

/** Build (not connect) a server over the products' operations. */
export function createMcpServer(opts: McpServerOptions): McpServer {
	const instructions = opts.products
		.map((p) => p.module.mcp?.instructions?.(opts.version))
		.filter((t): t is string => typeof t === 'string' && t.length > 0)
		.join('\n\n');
	const server = new McpServer(
		{ name: opts.name, version: opts.version },
		instructions ? { instructions } : {}
	);
	for (const p of opts.products) {
		for (const op of p.operations) {
			if (onSurface(op, 'mcp')) registerTool(server, p.module.id, op, p.ctx);
		}
		p.module.mcp?.register?.(server, p.ctx);
	}
	return server;
}

/** The input shape an operation advertises; destructive ones gain `yes`. */
export function toolInputShape(op: Operation): ZodRawShape {
	const shape = ((op.input as { shape?: unknown }).shape ?? {}) as ZodRawShape;
	if (!op.meta?.destructive) return shape;
	return {
		...shape,
		yes: z
			.boolean()
			.optional()
			.describe('Confirm this destructive action (also needs MAGIC_ALLOW_DESTRUCTIVE=1).'),
	};
}

/** Run one tool call: validate, gate, run, and wrap the result or the error. */
export async function callTool(
	product: string,
	op: Operation,
	ctx: OpContext,
	args: unknown
): Promise<{ content: { type: 'text'; text: string }[]; isError?: true }> {
	try {
		const { yes, ...rest } = (args ?? {}) as Record<string, unknown>;
		if (op.meta?.destructive) {
			if (!ctx.config.allowDestructive) throw destructiveDisabled(product);
			if (yes !== true) {
				throw new MagicError('destructive_action_disabled', 'This action is destructive.', {
					product,
					hint: 'Pass yes: true to confirm it.',
				});
			}
		}
		const parsed = op.input.safeParse(op.meta?.destructive ? rest : (args ?? {}));
		if (!parsed.success) throw invalidInput(product, parsed.error);
		const result = await op.run(parsed.data, ctx);
		return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
	} catch (err) {
		return toToolError(toMagicError(err, { product }));
	}
}

/** A zod failure as validation_failed, naming the first bad field. */
function invalidInput(product: string, error: z.ZodError): MagicError {
	const first = error.issues[0];
	const field = first?.path.join('.') ?? '';
	const message = first?.message ?? 'Invalid input.';
	return new MagicError('validation_failed', field ? `${field}: ${message}` : message, {
		product,
		...(field ? { details: { field } } : {}),
	});
}

function registerTool(server: McpServer, product: string, op: Operation, ctx: OpContext): void {
	const description = op.detail ? `${op.summary}\n\n${op.detail}` : op.summary;
	server.registerTool(
		toolName(op),
		{ description, inputSchema: toolInputShape(op) },
		async (args: unknown) => callTool(product, op, ctx, args)
	);
}
