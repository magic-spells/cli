// The credential store: file fallback (0600), the macOS `security` backend through
// an injected exec (COMPONENT-KEYCHAIN).

import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
	KEYCHAIN_SERVICE,
	createCredentialStore,
	credentialsFilePath,
	type ExecFile,
} from '../src/keychain.js';

const home = () => mkdtempSync(join(tmpdir(), 'kit-keychain-'));

describe('file backend', () => {
	it('writes { items } with mode 0600 and warns once', async () => {
		const warn = vi.fn();
		const h = home();
		const store = createCredentialStore({ platform: 'linux', env: {}, home: h, warn });
		expect(store.backend).toBe('file');
		await store.set('demo:manual', '{"key":"k1"}');
		await store.set('other:manual', '{"key":"k2"}');
		const path = credentialsFilePath({ platform: 'linux', env: {}, home: h });
		expect(path).toBe(join(h, '.config', 'magic', 'credentials.json'));
		expect(statSync(path).mode & 0o777).toBe(0o600);
		expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({
			items: { 'demo:manual': '{"key":"k1"}', 'other:manual': '{"key":"k2"}' },
		});
		expect(warn).toHaveBeenCalledOnce();
		expect(warn.mock.calls[0]![0]).toContain(path);
		expect(warn.mock.calls[0]![0]).not.toContain('k1');
	});

	it('get / locate / delete, idempotently', async () => {
		const store = createCredentialStore({
			platform: 'linux',
			env: {},
			home: home(),
			warn: () => {},
		});
		expect(await store.get('demo:manual')).toBeNull();
		await store.set('demo:manual', 's');
		expect(await store.get('demo:manual')).toBe('s');
		expect(await store.locate('demo:manual')).toBe('file');
		await store.delete('demo:manual');
		await store.delete('demo:manual');
		expect(await store.locate('demo:manual')).toBeNull();
	});

	it('honours XDG_CONFIG_HOME and APPDATA', () => {
		expect(
			credentialsFilePath({ platform: 'linux', env: { XDG_CONFIG_HOME: '/x' }, home: '/h' })
		).toBe(join('/x', 'magic', 'credentials.json'));
		expect(credentialsFilePath({ platform: 'win32', env: { APPDATA: '/ad' }, home: '/h' })).toBe(
			join('/ad', 'magic', 'credentials.json')
		);
	});

	it('MAGIC_CREDENTIALS_FILE=1 forces the file on macOS, without the warning', async () => {
		const warn = vi.fn();
		for (const platform of ['darwin', 'linux'] as const) {
			const store = createCredentialStore({
				platform,
				env: { MAGIC_CREDENTIALS_FILE: '1' },
				home: home(),
				warn,
			});
			expect(store.backend).toBe('file');
			await store.set('demo:manual', 'k1');
		}
		expect(warn).not.toHaveBeenCalled();
	});
});

describe('macOS keychain backend', () => {
	it('uses service io.magicspells.cli with the item as the account', async () => {
		const calls: string[][] = [];
		const exec: ExecFile = (_file, args) => {
			calls.push(args);
			if (args[0] === 'find-generic-password') return 'secret\n';
			return '';
		};
		const store = createCredentialStore({ platform: 'darwin', env: {}, home: home(), exec });
		expect(store.backend).toBe('keyring');
		await store.set('demo:manual', 'v');
		expect(await store.get('demo:manual')).toBe('secret');
		await store.delete('demo:manual');
		expect(await store.locate('demo:manual')).toBe('keyring');
		expect(calls[0]).toEqual([
			'add-generic-password',
			'-U',
			'-s',
			KEYCHAIN_SERVICE,
			'-a',
			'demo:manual',
			'-w',
			'v',
		]);
		expect(calls[1]).toEqual([
			'find-generic-password',
			'-s',
			KEYCHAIN_SERVICE,
			'-a',
			'demo:manual',
			'-w',
		]);
		expect(calls[2]).toEqual([
			'delete-generic-password',
			'-s',
			KEYCHAIN_SERVICE,
			'-a',
			'demo:manual',
		]);
	});

	it('falls back to the file when the keychain refuses, and get never throws', async () => {
		const warn = vi.fn();
		const exec: ExecFile = () => {
			throw new Error('denied');
		};
		const store = createCredentialStore({ platform: 'darwin', env: {}, home: home(), exec, warn });
		expect(await store.get('demo:manual')).toBeNull();
		await store.set('demo:manual', 'v');
		expect(warn).toHaveBeenCalledOnce();
		expect(await store.get('demo:manual')).toBe('v');
		expect(await store.locate('demo:manual')).toBe('file');
		expect(await store.locate('other:manual')).toBeNull();
	});
});
