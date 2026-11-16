// openBrowser settles once the opener spawns (FLOW-LOGIN-DEVICE). The detached,
// unref'd child holds no event loop, so waiting for its `close` let
// `magic login --device` exit with code 13 before the first poll. spawn is
// mocked: no browser opens.

import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

const spawn = vi.fn();
vi.mock('node:child_process', () => ({ spawn: (...args: unknown[]) => spawn(...args) }));

import { openBrowser } from '../src/browser.js';

/** A child that emits `event` and never closes, like an opener still running at exit. */
function child(event: 'spawn' | 'error') {
	const c = Object.assign(new EventEmitter(), { unref: vi.fn() });
	process.nextTick(() => c.emit(event, new Error('ENOENT')));
	return c;
}

describe('openBrowser', () => {
	it('resolves true once the opener spawns, without waiting for it to exit', async () => {
		spawn.mockReturnValueOnce(child('spawn'));
		await expect(openBrowser('https://example.test')).resolves.toBe(true);
	});

	it('resolves false when the opener cannot be spawned', async () => {
		spawn.mockReturnValueOnce(child('error'));
		await expect(openBrowser('https://example.test')).resolves.toBe(false);
	});
});
