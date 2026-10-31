// `magic mcp [--products a,b]` (COMPONENT-MCP-AGGREGATOR, FEATURE-MCP-AGGREGATOR): one
// stdio MCP server over every registered product's operations, tools prefixed
// `<product>_`. stdout belongs to the transport: console output is sent to stderr
// before any product code loads, and every diagnostic goes to stderr.
//
// No key is not fatal: the product's tools are still listed and each call resolves
// the key then, answering not_logged_in until one is stored (a key stored later is
// picked up without a restart). One stderr line says so at start.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
	buildContext,
	createMcpServer,
	productConfig,
	resolveCredential,
	toMagicError,
	type ContextSource,
	type McpProduct,
	type OpContext,
	type ProductModule,
} from '@magic-spells/kit';

import { version } from '../version.js';
import {
	loadProducts,
	noMoreArgs,
	rejectWorkspace,
	takeValue,
	wantsHelp,
	type Shell,
} from '../shell.js';

const PREAMBLE =
	'Magic MCP — tools for Magic Spells services. Every tool, resource and prompt is prefixed with its product (`pyramid_…`); each product’s rules follow under its own heading. Errors come back as `{ error: { code, message, hint, product } }`: act on `code`.';

export interface BuiltMcp {
	server: McpServer;
	products: McpProduct[];
}

/** Parse `magic mcp` args and build (not connect) the server. */
export async function buildMcp(
	shell: Shell,
	argv: string[],
	signal: AbortSignal
): Promise<BuiltMcp> {
	const args = [...argv];
	rejectWorkspace('mcp', shell.opts);
	const list = takeValue(args, 'products');
	noMoreArgs('mcp', args);
	const ids = list
		?.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	const products: McpProduct[] = [];
	for (const module of await loadProducts(shell, ids)) {
		const operations = await module.load();
		products.push({ module, operations, context: lazyContext(shell, module, signal) });
	}
	const server = createMcpServer({
		name: 'magic',
		version: version(),
		preamble: PREAMBLE,
		products,
	});
	return { server, products };
}

/** Resolve the context on first use and keep it once a key resolves. */
function lazyContext(shell: Shell, module: ProductModule, signal: AbortSignal): ContextSource {
	let ready: Promise<OpContext> | undefined;
	return () => {
		ready ??= (async () => {
			const config = productConfig(module, shell);
			return buildContext(module, config, { env: shell.env, store: shell.store, signal });
		})().catch((err: unknown) => {
			ready = undefined;
			throw err;
		});
		return ready;
	};
}

/** Serve over stdio until SIGINT/SIGTERM or the host closes stdin, then exit 0. */
export async function serveMcp(shell: Shell, argv: string[]): Promise<number> {
	if (wantsHelp(argv)) {
		shell.io.err(
			'Usage: magic mcp [--products a,b]\n\nServe every product’s tools to an MCP host over stdio.\n'
		);
		return 0;
	}
	guardStdout();
	const err = (line: string): void => shell.io.err(`magic mcp: ${line}\n`);
	const controller = new AbortController();
	const built = await buildMcp(shell, argv, controller.signal);
	const transport = new StdioServerTransport();

	let closing = false;
	const shutdown = async (reason: string): Promise<void> => {
		if (closing) return;
		closing = true;
		err(`shutting down (${reason}).`);
		controller.abort();
		try {
			await built.server.close();
		} catch (e) {
			err(`error during shutdown: ${toMagicError(e).message}`);
		}
		process.exit(0);
	};
	process.on('SIGINT', () => void shutdown('SIGINT'));
	process.on('SIGTERM', () => void shutdown('SIGTERM'));
	process.stdin.on('close', () => void shutdown('stdin closed'));
	process.stdin.on('end', () => void shutdown('stdin end'));

	await built.server.connect(transport);
	const summary = built.products.map((p) => `${p.module.id} (${p.operations.length} tools)`);
	err(`ready on stdio · ${summary.join(', ')}`);
	for (const { module } of built.products) {
		try {
			await resolveCredential(module, { env: shell.env, store: shell.store });
		} catch (e) {
			const why = toMagicError(e, { product: module.id });
			err(
				`${module.id}: ${why.message} Its tools answer ${why.code} until that is fixed. ${why.hint ?? ''}`.trim()
			);
		}
	}
	return 0;
}

/** Route console output to stderr so nothing but JSON-RPC reaches stdout. */
function guardStdout(): void {
	const toErr = (...args: unknown[]): void => {
		process.stderr.write(`${args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ')}\n`);
	};
	console.log = toErr;
	console.info = toErr;
	console.debug = toErr;
}
