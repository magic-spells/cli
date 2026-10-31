// loadCliConfig (DATATYPE-CLI-CONFIG): flag -> env -> file -> default.

import { describe, expect, it } from 'vitest';

import {
	DEFAULT_ACCOUNT_URL,
	loadCliConfig,
	productEnvVar,
	readConfigFile,
} from '../src/config.js';

const products = [{ id: 'demo', apiUrl: 'https://api.demo.example' }];

describe('loadCliConfig', () => {
	it('applies defaults', () => {
		const c = loadCliConfig({ products, env: {} });
		expect(c.accountUrl).toBe(DEFAULT_ACCOUNT_URL);
		expect(c.products.demo?.apiUrl).toBe('https://api.demo.example');
		expect(c.allowDestructive).toBe(false);
		expect(c.telemetry).toBe('unset');
		expect(c.updateCheck).toBe(true);
		expect(c.output).toEqual({ json: false, color: true, quiet: false, cache: true });
	});

	it('env beats file beats default for product URLs, trimming one trailing slash', () => {
		const file = { products: { demo: { apiUrl: 'https://file.example' } } };
		expect(loadCliConfig({ products, env: {}, file }).products.demo?.apiUrl).toBe(
			'https://file.example'
		);
		expect(
			loadCliConfig({ products, env: { MAGIC_DEMO_URL: 'https://env.example/v2/' }, file }).products
				.demo?.apiUrl
		).toBe('https://env.example/v2');
	});

	it('rejects a malformed URL as a usage error naming the source', () => {
		expect(() => loadCliConfig({ products, env: { MAGIC_DEMO_URL: 'not a url' } })).toThrow(
			/MAGIC_DEMO_URL/
		);
	});

	it('MAGIC_ALLOW_DESTRUCTIVE is exactly "1", env only', () => {
		expect(
			loadCliConfig({ products, env: { MAGIC_ALLOW_DESTRUCTIVE: '1' } }).allowDestructive
		).toBe(true);
		for (const v of ['0', 'true', 'yes', '', ' 1 ']) {
			expect(
				loadCliConfig({ products, env: { MAGIC_ALLOW_DESTRUCTIVE: v } }).allowDestructive
			).toBe(false);
		}
		const file = { allowDestructive: true } as never;
		expect(loadCliConfig({ products, env: {}, file }).allowDestructive).toBe(false);
	});

	it('--workspace beats the file default; CI turns off the update check; NO_COLOR', () => {
		const file = { defaultWorkspace: { demo: 'file-ws' }, telemetry: 'off' as const };
		expect(loadCliConfig({ products, env: {}, file }).defaultWorkspace).toEqual({
			demo: 'file-ws',
		});
		expect(
			loadCliConfig({ products, env: {}, file, workspace: 'flag-ws' }).defaultWorkspace
		).toEqual({
			demo: 'flag-ws',
		});
		expect(loadCliConfig({ products, env: {}, file }).telemetry).toBe('off');
		expect(loadCliConfig({ products, env: { CI: 'true' } }).updateCheck).toBe(false);
		expect(loadCliConfig({ products, env: { NO_COLOR: '1' } }).output.color).toBe(false);
	});

	it('productEnvVar', () => {
		expect(productEnvVar('demo', 'KEY')).toBe('MAGIC_DEMO_KEY');
		expect(productEnvVar('sites-engine', 'URL')).toBe('MAGIC_SITES_ENGINE_URL');
	});
});

describe('readConfigFile', () => {
	it('is null for a missing or malformed file', () => {
		expect(
			readConfigFile('/nope', () => {
				throw new Error('ENOENT');
			})
		).toBeNull();
		expect(readConfigFile('/x', () => 'not json')).toBeNull();
		expect(readConfigFile('/x', () => '{"telemetry":"on"}')).toEqual({ telemetry: 'on' });
	});
});
