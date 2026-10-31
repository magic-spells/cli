import { describe, expect, it } from 'vitest';

import { run } from '../src/main.js';

function io(tty = false) {
	const cap = { stdout: '', stderr: '' };
	return {
		cap,
		io: {
			out: (t: string) => void (cap.stdout += t),
			err: (t: string) => void (cap.stderr += t),
			isTTY: () => tty,
		},
	};
}

describe('magic shell', () => {
	it('--version prints the package version on stdout', async () => {
		const { cap, io: sink } = io();
		expect(await run(['--version'], { io: sink })).toBe(0);
		expect(cap.stdout).toMatch(/^magic \d+\.\d+\.\d+\n$/);
	});

	it('--help lists products on stderr and exits 0', async () => {
		const { cap, io: sink } = io();
		expect(await run(['--help'], { io: sink })).toBe(0);
		expect(cap.stderr).toContain('Usage: magic');
		expect(cap.stderr).toContain('pyramid');
		expect(cap.stdout).toBe('');
	});

	it('an unknown command is a usage error (exit 2)', async () => {
		const { io: sink } = io();
		expect(await run(['bogus'], { io: sink })).toBe(2);
	});

	it('magic pyramid --help lists the Pyramid tree in pyramid-cli’s shape', async () => {
		const { cap, io: sink } = io();
		expect(await run(['pyramid', '--help'], { io: sink, env: {} })).toBe(0);
		for (const c of [
			'whoami',
			'project list',
			'task list-mine (next)',
			'task update <task>',
			'task comment <task> <content>',
			'login',
		]) {
			expect(cap.stderr).toContain(c);
		}
	});

	it('magic pyramid task next without a key is not_logged_in (exit 3)', async () => {
		const { cap, io: sink } = io();
		const store = {
			backend: 'file' as const,
			get: async () => null,
			set: async () => {},
			delete: async () => {},
			list: async () => [],
		};
		expect(await run(['pyramid', 'task', 'next'], { io: sink, env: {}, store })).toBe(3);
		expect(JSON.parse(cap.stderr).error).toMatchObject({
			code: 'not_logged_in',
			product: 'pyramid',
		});
	});
});
