// Registry checks, the TTL cache, the doctor runner, and the kit's product-neutrality
// rule (FEATURE-KIT-EXTRACTION acceptance: no product package import, no product name).

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { TtlCache } from '../src/cache.js';
import { runDoctorChecks } from '../src/doctor.js';
import { MagicError } from '../src/errors.js';
import { assertRegistry, commandWords, toolName, type Operation } from '../src/operation.js';
import { demoOps } from './helpers.js';

const op = (name: string): Operation => ({
	name: name as Operation['name'],
	summary: '',
	input: z.object({}),
	run: async () => null,
});

describe('registry', () => {
	it('derives tool names and command words', () => {
		expect(toolName({ name: 'demo.widget.list-mine' })).toBe('demo_widget_list_mine');
		expect(commandWords({ name: 'demo.widget.list-mine' })).toEqual(['widget', 'list-mine']);
		expect(commandWords({ name: 'demo.whoami' })).toEqual(['whoami']);
	});

	it('accepts the demo registry', () => {
		expect(() => assertRegistry('demo', demoOps)).not.toThrow();
	});

	it('rejects foreign prefixes, bad shapes and duplicates', () => {
		expect(() => assertRegistry('demo', [op('other.a.b')])).toThrow(/demo\.<noun>\.<verb>/);
		expect(() => assertRegistry('demo', [op('demo.a.b.c')])).toThrow();
		expect(() => assertRegistry('demo', [op('demo.Widget.list')])).toThrow(/lower case/);
		expect(() => assertRegistry('demo', [op('demo.a.b'), op('demo.a.b')])).toThrow(
			/duplicate operation/
		);
		expect(() => assertRegistry('demo', [op('demo.a.b-c'), op('demo.a.b_c')])).toThrow();
	});
});

describe('TtlCache', () => {
	it('expires entries after the TTL and loads once while live', async () => {
		let now = 0;
		const cache = new TtlCache<number>(100, () => now);
		let loads = 0;
		const load = async () => ++loads;
		expect(await cache.getOrLoad('k', load)).toBe(1);
		now = 99;
		expect(await cache.getOrLoad('k', load)).toBe(1);
		now = 100;
		expect(cache.get('k')).toBeUndefined();
		expect(await cache.getOrLoad('k', load)).toBe(2);
		cache.clear();
		expect(cache.get('k')).toBeUndefined();
	});
});

describe('runDoctorChecks', () => {
	it('reports each check and turns a throw into a failed result with its code', async () => {
		const results = await runDoctorChecks(
			[
				{ name: 'ok', run: async () => ({ ok: true, detail: 'fine' }) },
				{
					name: 'auth',
					run: async () => {
						throw new MagicError('auth_invalid', 'bad key', { hint: 'new key' });
					},
				},
			],
			{} as never
		);
		expect(results).toEqual([
			{ name: 'ok', ok: true, detail: 'fine' },
			{ name: 'auth', ok: false, detail: 'bad key — new key', code: 'auth_invalid' },
		]);
	});
});

describe('kit stays product-neutral', () => {
	const src = fileURLToPath(new URL('../src/', import.meta.url));
	const files = readdirSync(src).filter((f) => f.endsWith('.ts'));
	const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
		dependencies?: Record<string, string>;
	};

	it('names no product in source', () => {
		for (const f of files) {
			// Provenance notes may cite the CLI the kit was extracted from.
			const text = readFileSync(join(src, f), 'utf8').replaceAll('pyramid-cli', '');
			expect(text, f).not.toMatch(/pyramid|sites|marketing|pyk_|pmk_/i);
		}
	});

	it('imports and depends on no product package', () => {
		for (const f of files) {
			const text = readFileSync(join(src, f), 'utf8');
			expect(text, f).not.toMatch(/from '@magic-spells\//);
		}
		expect(
			Object.keys(pkg.dependencies ?? {}).filter((d) => d.startsWith('@magic-spells/'))
		).toEqual([]);
	});
});
