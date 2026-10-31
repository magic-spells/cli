import { describe, expect, it } from 'vitest';

import { run, type ShellIO } from '../src/main.js';

function io(): ShellIO & { stdout: string; stderr: string } {
	const cap = { stdout: '', stderr: '' } as ShellIO & { stdout: string; stderr: string };
	cap.out = (t) => void (cap.stdout += t);
	cap.err = (t) => void (cap.stderr += t);
	return cap;
}

describe('magic shell', () => {
	it('--version prints the package version on stdout', async () => {
		const cap = io();
		expect(await run(['--version'], cap)).toBe(0);
		expect(cap.stdout).toMatch(/^magic \d+\.\d+\.\d+\n$/);
	});

	it('--help prints usage on stderr and exits 0', async () => {
		const cap = io();
		expect(await run(['--help'], cap)).toBe(0);
		expect(cap.stderr).toContain('Usage: magic');
		expect(cap.stdout).toBe('');
	});

	it('an unknown command is a usage error (exit 2)', async () => {
		const cap = io();
		expect(await run(['bogus'], cap)).toBe(2);
	});
});
