// Product API hosts (DATATYPE-CLI-CONFIG): each product's default, and the env override.

import { describe, expect, it } from 'vitest';

import { loadCliConfig } from '@magic-spells/kit';
import pyramid from '@magic-spells/pyramid';
import sites from '@magic-spells/sites';

const resolve = (p: { id: string; apiUrl: string }, env: NodeJS.ProcessEnv = {}) =>
	loadCliConfig({ products: [{ id: p.id, apiUrl: p.apiUrl }], env }).products[p.id]?.apiUrl;

describe('product API hosts', () => {
	it('Pyramid defaults to its web host; MAGIC_PYRAMID_URL overrides', () => {
		expect(resolve(pyramid)).toBe('https://pyramid.magicspells.io');
		expect(resolve(pyramid, { MAGIC_PYRAMID_URL: 'http://127.0.0.1:9' })).toBe(
			'http://127.0.0.1:9'
		);
	});

	it('Sites defaults to sites-api; MAGIC_SITES_URL overrides', () => {
		expect(resolve(sites)).toBe('https://sites-api.magicspells.io');
		expect(resolve(sites, { MAGIC_SITES_URL: 'http://127.0.0.1:9' })).toBe('http://127.0.0.1:9');
	});
});
