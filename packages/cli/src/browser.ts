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

/**
 * Try to open a URL in the default browser. Whether one opened is unknowable (an
 * opener can start and still fail), so callers always print the URL as well.
 */
export function openBrowser(url: string): void {
	const platform = process.platform;
	// Not `cmd /c start`: cmd splits the URL at every `&` of the authorize query.
	const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'rundll32' : 'xdg-open';
	const args = platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
	const child = spawn(command, args, { detached: true, stdio: 'ignore' });
	child.on('error', () => {}); // a missing opener: the printed URL is the way in
	child.unref();
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
