// FILE-PROMPTS — MCP prompt skin.
//
// One prompt, `pyramid_doctor`: a self-check. It expands to an instruction telling the
// model to call the `pyramid_whoami` tool and report the authenticated user, their
// workspace, and the accessible projects — confirming the key + connection are
// wired correctly. No arguments; no Pyramid calls happen here (the model drives
// the tool call when it runs the prompt).

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const DOCTOR_DESCRIPTION =
	'Check your Pyramid setup: confirm the API key authenticates and show the user, workspace, and accessible projects.';

const DOCTOR_INSTRUCTION = [
	'Run a Pyramid setup check.',
	'',
	'Call the `pyramid_whoami` tool, then report back, in plain language:',
	'  • the authenticated user (display name and email),',
	'  • the workspace (name) you are connected to, and',
	'  • the accessible projects (names).',
	'',
	'Finish by confirming the setup looks good. If `pyramid_whoami` returns an error,',
	'act on its `code`: for an `auth_*` code, tell the user to regenerate their',
	'key in Pyramid → Settings → API Keys. Never print raw JSON or an HTTP status.',
].join('\n');

/**
 * Register the `pyramid_doctor` prompt on the server. The prompt is static: it
 * instructs the model to invoke the `pyramid_whoami` tool.
 */
export function registerPrompts(server: McpServer): void {
	server.registerPrompt('pyramid_doctor', { description: DOCTOR_DESCRIPTION }, () => ({
		messages: [
			{
				role: 'user' as const,
				content: { type: 'text' as const, text: DOCTOR_INSTRUCTION },
			},
		],
	}));
}
