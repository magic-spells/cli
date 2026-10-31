// The browser side of `magic login` (FLOW-LOGIN-LOOPBACK, FLOW-LOGIN-DEVICE): whether a
// browser is local, opening one, and asking yes/no on the terminal.

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

/**
 * A browser is local unless this is an SSH session or a Linux box without a display.
 * Then login uses the device flow and prints a code for another device.
 */
export function browserIsLocal(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): boolean {
	if (env.SSH_CONNECTION) return false;
	if (platform === 'linux') return Boolean(env.DISPLAY || env.WAYLAND_DISPLAY);
	return true;
}

/** Open a URL in the default browser; false when that could not be done. */
export function openBrowser(url: string): Promise<boolean> {
	return new Promise((resolve) => {
		const platform = process.platform;
		const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
		const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
		const child = spawn(command, args, { detached: true, stdio: 'ignore' });
		child.once('error', () => resolve(false));
		child.once('close', (code) => resolve(code === 0));
		child.unref();
	});
}

/** Ask a yes/no question on the terminal (stderr prompt, stdin answer); default no. */
export async function confirmOnTty(question: string): Promise<boolean> {
	const rl = createInterface({ input: process.stdin, output: process.stderr });
	try {
		return /^y(es)?$/i.test((await rl.question(question)).trim());
	} finally {
		rl.close();
	}
}
