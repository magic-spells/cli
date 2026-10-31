// A fake Pyramid API on 127.0.0.1 for the shell's tests: enough of /v1 for
// whoami, doctor and a tool call. Never production.

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export const KEY = 'pyk_ab23cd45_0123456789abcdef';
export const SECRET = '0123456789abcdef';

const ROUTES: Record<string, unknown> = {
	'GET /v1/me': { id: 'u-ann', display_name: 'Ann Smith', email: 'ann@example.com' },
	'GET /v1/workspaces': { data: [{ id: 'w1', handle: 'acme', name: 'Acme', role: 'owner' }] },
	'GET /v1/projects': {
		data: [{ id: 'p-web', handle: 'web', name: 'Website', task_prefix: 'WEB', role: 'admin' }],
	},
	'GET /v1/projects/p-web/workflow': { stages: [], statuses: [] },
	'GET /v1/projects/p-web/labels': [],
	'GET /v1/projects/p-web/members': [],
	'GET /v1/projects/p-web/task-schema': { templates: [] },
};

export interface FakeApi {
	url: string;
	close(): Promise<void>;
}

export async function startFakeApi(): Promise<FakeApi> {
	const server: Server = createServer((req, res) => {
		const path = new URL(req.url ?? '/', 'http://x').pathname;
		const send = (status: number, body: unknown): void => {
			res.writeHead(status, { 'content-type': 'application/json' });
			res.end(JSON.stringify(body));
		};
		if (req.method === 'HEAD') return send(404, {});
		if (req.headers.authorization !== `Bearer ${KEY}`) {
			return send(401, { error: { code: 'unauthorized', message: 'bad key' } });
		}
		const body = ROUTES[`${req.method} ${path}`];
		if (body === undefined) return send(404, { error: { code: 'not_found', message: path } });
		send(200, body);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	return {
		url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
		close: () => new Promise<void>((resolve) => server.close(() => resolve())),
	};
}
