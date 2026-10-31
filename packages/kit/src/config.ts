// CLI configuration (DATATYPE-CLI-CONFIG). Every value resolves flag -> environment ->
// config file -> default. The config file never holds secrets, and the destructive
// gate is environment-only.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MagicError } from './errors.js';
import { configDir, type PathEnv } from './paths.js';

export const DEFAULT_ACCOUNT_URL = 'https://account.magicspells.io';

export interface CliOutput {
	json: boolean;
	color: boolean;
	quiet: boolean;
}

export interface CliConfig {
	accountUrl: string;
	/** Per product id. */
	products: Record<string, { apiUrl: string }>;
	/** Default workspace handle per product id; --workspace wins. */
	defaultWorkspace: Record<string, string>;
	/** MAGIC_ALLOW_DESTRUCTIVE === '1'. Never read from the file. */
	allowDestructive: boolean;
	telemetry: 'unset' | 'on' | 'off';
	updateCheck: boolean;
	output: CliOutput;
}

/** The parts of the config file the CLI reads. */
export interface ConfigFile {
	accountUrl?: string;
	products?: Record<string, { apiUrl?: string }>;
	defaultWorkspace?: Record<string, string>;
	telemetry?: 'on' | 'off';
}

export interface ProductUrlSpec {
	id: string;
	apiUrl: string;
}

/** `MAGIC_<ID>_<SUFFIX>`, e.g. MAGIC_ACME_URL. */
export function productEnvVar(id: string, suffix: string): string {
	return `MAGIC_${id.toUpperCase().replace(/-/g, '_')}_${suffix}`;
}

export function configFilePath(opts: PathEnv = {}): string {
	return join(configDir(opts), 'config.json');
}

/** Read the config file; a missing or unreadable file is no file. */
export function readConfigFile(
	path: string = configFilePath(),
	read: (p: string) => string = (p) => readFileSync(p, 'utf8')
): ConfigFile | null {
	try {
		const parsed: unknown = JSON.parse(read(path));
		return parsed && typeof parsed === 'object' ? (parsed as ConfigFile) : null;
	} catch {
		return null;
	}
}

export interface LoadConfigOptions {
	products: ProductUrlSpec[];
	env?: NodeJS.ProcessEnv;
	file?: ConfigFile | null;
	output?: Partial<CliOutput>;
	/** --workspace, applied to every product. */
	workspace?: string;
}

/** Resolve the CliConfig. Throws a usage MagicError on a malformed URL. */
export function loadCliConfig(opts: LoadConfigOptions): CliConfig {
	const env = opts.env ?? process.env;
	const file = opts.file ?? null;

	const products: CliConfig['products'] = {};
	const defaultWorkspace: CliConfig['defaultWorkspace'] = {};
	for (const p of opts.products) {
		const envVar = productEnvVar(p.id, 'URL');
		products[p.id] = {
			apiUrl: normalizeUrl(env[envVar] || file?.products?.[p.id]?.apiUrl || p.apiUrl, envVar),
		};
		const ws = opts.workspace ?? file?.defaultWorkspace?.[p.id];
		if (ws) defaultWorkspace[p.id] = ws;
	}

	const fileTelemetry = file?.telemetry;
	return {
		accountUrl: normalizeUrl(
			env.MAGIC_ACCOUNT_URL || file?.accountUrl || DEFAULT_ACCOUNT_URL,
			'MAGIC_ACCOUNT_URL'
		),
		products,
		defaultWorkspace,
		allowDestructive: env.MAGIC_ALLOW_DESTRUCTIVE === '1',
		telemetry: fileTelemetry === 'on' || fileTelemetry === 'off' ? fileTelemetry : 'unset',
		updateCheck: !env.CI && !env.MAGIC_NO_UPDATE_CHECK,
		output: {
			json: opts.output?.json ?? false,
			color: opts.output?.color ?? !env.NO_COLOR,
			quiet: opts.output?.quiet ?? false,
		},
	};
}

/** Trim one trailing slash and check the value parses; base paths are kept verbatim. */
function normalizeUrl(value: string, source: string): string {
	const trimmed = value.endsWith('/') ? value.slice(0, -1) : value;
	try {
		new URL(trimmed);
	} catch {
		throw new MagicError('usage', `${source} is not a valid URL: "${value}".`);
	}
	return trimmed;
}
