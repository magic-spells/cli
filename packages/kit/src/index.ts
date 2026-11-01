// @magic-spells/kit — the product-agnostic core of the Magic CLI (COMPONENT-KIT).
// Product packages import from here; this package imports no product package.

export * from './errors.js';
export * from './operation.js';
export * from './config.js';
export * from './credentials.js';
export * from './keychain.js';
export * from './render.js';
export * from './argv.js';
export * from './context.js';
export * from './doctor.js';
export * from './account.js';
export * from './loopback.js';
export * from './sessions.js';
export * from './update.js';
export { runProductCli, helpText, destructiveDisabled, type RunProductDeps } from './cli.js';
export {
	createMcpServer,
	callTool,
	toolInputShape,
	type McpProduct,
	type McpServerOptions,
} from './mcp.js';
export { configDir } from './paths.js';
export { TtlCache } from './cache.js';
export { rec, readField, readStr } from './read.js';
export { readPackageVersion } from './version.js';
