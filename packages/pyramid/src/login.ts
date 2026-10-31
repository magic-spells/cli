// `magic pyramid login` — the browser handoff from pyramid-cli's `pyramid login`
// (COMPONENT-PYRAMID-PACKAGE, FEATURE-PYRAMID-MOVE): a loopback callback on 127.0.0.1
// receives a workspace `pyk_` key minted by Pyramid web's /auth/cli and stores it as
// the `pyramid:manual` item. Kept until R1's `magic login` replaces it. The key
// arrives only in a urlencoded POST body (`state`, `key`, `name` or `error`), never in
// the URL, because URLs get logged; a GET or a `key` in the query string is refused
// unread. The full secret is never printed.
//
// pyramid-cli's set-key / show-key / logout move to the shell's
// `magic login --product-key`, `magic whoami` and `magic logout --product pyramid`
// (FEATURE-WHOAMI-DOCTOR), on the kit's saveProductKey / forgetProductKey.

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createCredentialStore, maskKey, saveProductKey } from '@magic-spells/kit';

import { PYRAMID_CREDENTIAL } from './credential.js';

const DEFAULT_WEB_URL = 'https://pyramid.magicspells.io';
const DEFAULT_LOGIN_TIMEOUT_MS = 2 * 60 * 1000;
/** The callback form carries a state, a key and a name; anything bigger is not it. */
const MAX_CALLBACK_BODY_BYTES = 4 * 1024;

/** Injected side effects, so the handoff is unit-testable without a keychain. */
export interface AuthIO {
	out: (line: string) => void;
	setKey: (key: string) => Promise<void>;
	openBrowser: (url: string) => boolean | Promise<boolean>;
	env: NodeJS.ProcessEnv;
	randomState: () => string;
	loginTimeoutMs: number;
}

const realIO: AuthIO = {
	out: (line) => process.stderr.write(`${line}\n`),
	setKey: async (key) => {
		await saveProductKey(PYRAMID_CREDENTIAL, createCredentialStore(), key);
	},
	openBrowser,
	env: process.env,
	randomState: () => randomBytes(24).toString('base64url'),
	loginTimeoutMs: DEFAULT_LOGIN_TIMEOUT_MS,
};

interface LoginOptions {
	webUrl: string;
	name: string;
}

const LOGIN_USAGE = 'usage: magic pyramid login [--web-url <url>] [--name <key name>]';

function parseLoginOptions(argv: string[], env: NodeJS.ProcessEnv): LoginOptions | 'help' | string {
	let webUrl = env.MAGIC_PYRAMID_WEB_URL?.trim() || DEFAULT_WEB_URL;
	let name = 'Magic CLI';
	const args = argv;
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i]!;
		if (arg === '--help' || arg === '-h') return 'help';
		if (arg === '--web-url') {
			const next = args[++i];
			if (!next) return LOGIN_USAGE;
			webUrl = next;
			continue;
		}
		if (arg.startsWith('--web-url=')) {
			webUrl = arg.slice('--web-url='.length);
			continue;
		}
		if (arg === '--name') {
			const next = args[++i];
			if (!next) return LOGIN_USAGE;
			name = next;
			continue;
		}
		if (arg.startsWith('--name=')) {
			name = arg.slice('--name='.length);
			continue;
		}
		return `unknown option for magic pyramid login: ${arg}`;
	}
	try {
		new URL(webUrl);
	} catch {
		return `MAGIC_PYRAMID_WEB_URL is not a valid URL: "${webUrl}".`;
	}
	return { webUrl, name: name.trim() || 'Magic CLI' };
}

function authURL(webUrl: string, callbackURL: string, state: string, name: string): string {
	const target = new URL('/auth/cli', webUrl);
	target.searchParams.set('redirect_uri', callbackURL);
	target.searchParams.set('state', state);
	target.searchParams.set('name', name);
	return target.toString();
}

/** The urlencoded callback body, or null once it passes the size cap. */
function readCallbackForm(req: IncomingMessage): Promise<URLSearchParams | null> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let size = 0;
		const onData = (chunk: Buffer) => {
			size += chunk.length;
			if (size > MAX_CALLBACK_BODY_BYTES) {
				req.off('data', onData);
				req.resume();
				resolve(null);
				return;
			}
			chunks.push(chunk);
		};
		req.on('data', onData);
		req.once('end', () => resolve(new URLSearchParams(Buffer.concat(chunks).toString('utf8'))));
		req.once('error', reject);
	});
}

function closeServer(server: Server): Promise<void> {
	return new Promise((resolve) => {
		server.close(() => resolve());
	});
}

/** `magic pyramid login` — browser handoff that stores a minted API key locally. */
export async function runLogin(argv: string[], io: AuthIO = realIO): Promise<number> {
	const opts = parseLoginOptions(argv, io.env);
	if (opts === 'help') {
		io.out(LOGIN_USAGE);
		io.out('Opens Pyramid in the browser and stores the workspace key it mints.');
		return 0;
	}
	if (typeof opts === 'string') {
		io.out(opts);
		return 2;
	}

	const state = io.randomState();
	let settled = false;
	let timeout: NodeJS.Timeout | undefined;
	let finish!: (code: number) => void;
	const done = new Promise<number>((resolve) => {
		finish = (code) => {
			if (settled) return;
			settled = true;
			if (timeout) clearTimeout(timeout);
			resolve(code);
		};
	});

	const server = createServer(async (req, res) => {
		const requestURL = new URL(req.url ?? '/', 'http://127.0.0.1');
		if (requestURL.pathname !== '/callback') {
			res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
			res.end('Not found.\n');
			return;
		}

		if (req.method !== 'POST' || requestURL.searchParams.has('key')) {
			res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'POST' });
			res.end('Method not allowed. Return to your terminal.\n');
			io.out('Ignored a Pyramid login callback that did not POST the key.');
			return;
		}

		let form: URLSearchParams | null;
		try {
			form = await readCallbackForm(req);
		} catch {
			return;
		}
		if (!form) {
			res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8', connection: 'close' });
			res.end('Login callback too large. Return to your terminal.\n');
			io.out('Ignored an oversized Pyramid login callback.');
			return;
		}

		const gotState = form.get('state') ?? '';
		if (gotState !== state) {
			res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
			res.end('Invalid login state. Return to your terminal.\n');
			io.out('Rejected Pyramid login callback with an invalid state.');
			void closeServer(server).then(() => finish(1));
			return;
		}

		const error = form.get('error');
		if (error) {
			res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
			res.end('Pyramid login cancelled. Return to your terminal.\n');
			io.out(
				error === 'access_denied' ? 'Pyramid login cancelled.' : `Pyramid login failed: ${error}`
			);
			void closeServer(server).then(() => finish(1));
			return;
		}

		const key = form.get('key')?.trim() ?? '';
		if (!key.startsWith('pyk_')) {
			res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
			res.end('Invalid Pyramid key. Return to your terminal.\n');
			io.out('Pyramid login returned an invalid key.');
			void closeServer(server).then(() => finish(1));
			return;
		}

		try {
			await io.setKey(key);
		} catch (err) {
			res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
			res.end('Could not store the key. Return to your terminal.\n');
			io.out(
				`Could not store the Pyramid key: ${err instanceof Error ? err.message : String(err)}`
			);
			void closeServer(server).then(() => finish(1));
			return;
		}
		res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
		res.end('Pyramid CLI connected. You can close this tab.\n');
		io.out(
			`Saved ${maskKey(key, PYRAMID_CREDENTIAL.credential)} — magic and magic mcp will use it automatically.`
		);
		void closeServer(server).then(() => finish(0));
	});

	try {
		await new Promise<void>((resolve, reject) => {
			server.once('error', reject);
			server.listen(0, '127.0.0.1', () => {
				server.off('error', reject);
				resolve();
			});
		});
	} catch (err) {
		io.out(
			`Could not start the local Pyramid login server: ${err instanceof Error ? err.message : String(err)}`
		);
		return 1;
	}

	const address = server.address() as AddressInfo;
	const callbackURL = `http://127.0.0.1:${address.port}/callback`;
	const loginURL = authURL(opts.webUrl, callbackURL, state, opts.name);

	timeout = setTimeout(() => {
		io.out('Pyramid login timed out before the browser completed the handoff.');
		void closeServer(server).then(() => finish(1));
	}, io.loginTimeoutMs);

	const opened = await io.openBrowser(loginURL);
	if (opened) {
		io.out('Opened Pyramid in your browser. Authorize the CLI to finish login.');
	} else {
		io.out('Could not open your browser automatically. Open this URL to finish login:');
		io.out(loginURL);
	}

	return done;
}

function openBrowser(url: string): Promise<boolean> {
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
