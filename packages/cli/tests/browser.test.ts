// openBrowser is best effort: a missing opener must not crash `magic login`, which
// prints the URL anyway. spawn is mocked: no browser opens.

import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

const opener = Object.assign(new EventEmitter(), { unref: vi.fn() });
vi.mock('node:child_process', () => ({ spawn: () => opener }));

import { openBrowser } from '../src/browser.js';

describe('openBrowser', () => {
	it('swallows the error of an opener that cannot be spawned', () => {
		openBrowser('https://example.test');
		// An `error` with no listener would throw here, and in the CLI crash the process.
		expect(() => opener.emit('error', new Error('ENOENT'))).not.toThrow();
		expect(opener.unref).toHaveBeenCalled();
	});
});
