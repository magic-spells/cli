// @magic-spells/kit — the product-agnostic core of the Magic CLI (COMPONENT-KIT).
// Product packages import from here; this package imports no product package.

export * from './errors.js';
export { TtlCache } from './cache.js';
export { rec, readField, readStr } from './read.js';
export { readPackageVersion } from './version.js';
