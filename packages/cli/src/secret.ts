// Reading a product key (DOC-SECURITY): from a hidden TTY prompt, or from stdin when
// it is piped. Never from argv, never echoed.

import { cancelled } from './shell.js';

export async function readSecret(prompt: string): Promise<string> {
	const stdin = process.stdin;
	if (!stdin.isTTY) {
		// Say so, or an open pipe that never closes looks like a hang.
		process.stderr.write('reading key from stdin…\n');
		return (await readAll(stdin)).trim();
	}

	process.stderr.write(prompt);
	stdin.setRawMode(true);
	stdin.setEncoding('utf8');
	stdin.resume();
	return new Promise((resolve, reject) => {
		let value = '';
		const finish = (): void => {
			stdin.off('data', onData);
			stdin.setRawMode(false);
			stdin.pause();
			process.stderr.write('\n');
		};
		const onData = (chunk: string): void => {
			for (const ch of chunk) {
				if (ch === '\r' || ch === '\n' || ch === '\u0004') {
					finish();
					resolve(value.trim());
					return;
				}
				if (ch === '\u0003') {
					finish();
					reject(cancelled());
					return;
				}
				if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
				else value += ch;
			}
		};
		stdin.on('data', onData);
	});
}

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
	let text = '';
	for await (const chunk of stream) text += String(chunk);
	return text;
}
