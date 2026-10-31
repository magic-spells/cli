// The plugin interface (DATATYPE-OPERATION, COMPONENT-OPERATION-REGISTRY,
// DECISION-OPERATIONS-ARE-THE-CONTRACT). A product package default-exports a
// ProductModule; the shell derives CLI commands and MCP tools from its operations.
// Operations know nothing about either front-end: no argv, no stdout, no MCP types.

import type { z } from 'zod';

import type { CliConfig } from './config.js';
import type { ProductSession } from './credentials.js';
import type { DoctorCheck } from './doctor.js';

/** Everything an operation's `run` receives. */
export interface OpContext<C = unknown> {
	config: CliConfig;
	/** null when the operation does not need a session (requiresSession: false). */
	session: ProductSession | null;
	/** The product's client, built by ProductModule.client. */
	client: C;
	/** Cancelled on SIGINT. */
	signal: AbortSignal;
}

/**
 * `product.noun.verb` (CLI `magic <product> <noun> <verb>`, MCP `product_noun_verb`).
 * A two-part `product.verb` is a product-level command (`magic acme whoami`).
 */
export type OperationName = `${string}.${string}`;

export interface OperationCliMeta {
	/** Input keys taken positionally, in order. */
	positionals?: string[];
	/** Flag alias -> input key. */
	aliases?: Record<string, string>;
	/** Extra words for the verb (e.g. `next` for `list-mine`, `ls` for `list`). */
	verbAliases?: string[];
	/** `--file <path>` loads a JSON array (or `{ <key>: [...] }`) into this input key. */
	fileInput?: string;
	/** Presence flags that set input values (`--unarchive` -> `{ archived: false }`). */
	presets?: Record<string, Record<string, unknown>>;
	/** Presence flags that hand the call to another operation (`--mine` -> list-mine). */
	routes?: Record<string, OperationName>;
}

export interface Operation<I = any, O = unknown, C = any> {
	name: OperationName;
	/** One line: CLI help and MCP description. */
	summary: string;
	/** Long help; appended to the MCP description. */
	detail?: string;
	input: z.ZodObject<z.ZodRawShape>;
	run(input: I, ctx: OpContext<C>): Promise<O>;
	meta?: {
		/** Needs --yes (CLI) or yes:true (MCP) AND MAGIC_ALLOW_DESTRUCTIVE=1. */
		destructive?: boolean;
		/** Default both. */
		surfaces?: ('cli' | 'mcp')[];
		cli?: OperationCliMeta;
		/** Default true; false for local-only operations. */
		requiresSession?: boolean;
	};
}

/** A non-operation product command (interactive, local), e.g. a browser login. */
export type ProductCommand = (argv: string[]) => Promise<number>;

/**
 * The context for one MCP call, resolved per call so a product without a key still
 * lists its tools and a key stored later is picked up (FEATURE-MCP-AGGREGATOR).
 * Rejects with not_logged_in when there is no key.
 */
export type ContextSource<C = any> = () => Promise<OpContext<C>>;

export interface ProductMcp<C = any> {
	/** The product's model-facing text; `version` is the CLI's. */
	instructions?: (version: string) => string;
	/** Register the product's resources and prompts; names must carry the product prefix. */
	register?(server: unknown, context: ContextSource<C>): void;
}

export interface ProductModule<C = any> {
	/** Lower-case product id, the CLI namespace and the MCP prefix. */
	id: string;
	/** Display name ("Acme"). */
	title: string;
	/** The product key prefix (`ack_`). */
	credential: string;
	/** Default API base URL; MAGIC_<ID>_URL or the config file override it. */
	apiUrl: string;
	/** Where a person gets a key, for not_logged_in hints. */
	keyHelp?: string;
	/**
	 * The product's CLI sessions route (FLOW-PRODUCT-SESSION-MINT), relative to apiUrl:
	 * `magic login` mints a key per workspace there from the Account grant, and the kit
	 * re-mints on auth_expired. Absent: pasted keys only.
	 */
	sessions?: { path: string };
	/** The only async step: native products return a static list. */
	load(): Promise<Operation<any, unknown, C>[]>;
	client(session: ProductSession, config: CliConfig): C;
	/** Value flags read anywhere in argv and used as defaults for inputs of that name. */
	globalFlags?: string[];
	commands?: Record<string, { summary: string; run: ProductCommand }>;
	doctor?: DoctorCheck<C>[];
	mcp?: ProductMcp<C>;
}

/** The MCP tool name: dots and dashes become underscores. */
export function toolName(op: Pick<Operation, 'name'>): string {
	return op.name.replace(/[.-]/g, '_');
}

/** The CLI words after the product: `acme.task.list-mine` -> ['task', 'list-mine']. */
export function commandWords(op: Pick<Operation, 'name'>): string[] {
	return op.name.split('.').slice(1);
}

/** Whether an operation is exposed on a surface. */
export function onSurface(op: Operation, surface: 'cli' | 'mcp'): boolean {
	return op.meta?.surfaces?.includes(surface) ?? true;
}

/**
 * Check a registry: every name is `<product>.…`, two or three parts, lower case, and
 * unique (including its MCP tool name). Throws on the first problem, so a bad
 * registry fails its build test, not a run.
 */
export function assertRegistry(product: string, ops: Operation[]): void {
	const names = new Set<string>();
	const tools = new Set<string>();
	for (const op of ops) {
		const parts = op.name.split('.');
		if (parts[0] !== product || parts.length < 2 || parts.length > 3) {
			throw new Error(`operation "${op.name}" must be named ${product}.<noun>.<verb>`);
		}
		if (!parts.every((p) => /^[a-z][a-z0-9-]*$/.test(p))) {
			throw new Error(`operation "${op.name}" must be lower case words`);
		}
		if (names.has(op.name)) throw new Error(`duplicate operation "${op.name}"`);
		if (tools.has(toolName(op))) throw new Error(`duplicate MCP tool "${toolName(op)}"`);
		names.add(op.name);
		tools.add(toolName(op));
	}
}
