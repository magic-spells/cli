// Pyramid's MCP contribution (COMPONENT-PYRAMID-PACKAGE "mcp"): the instructions text,
// resources and prompts, carried from pyramid-cli's src/mcp/server.ts. The kit's MCP
// builder registers the operations themselves as `pyramid_*` tools.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { OpContext } from '../operations/index.js';
import { registerPrompts } from './prompts.js';
import { registerResources } from './resources.js';

/**
 * The model-facing contract for driving Pyramid and rendering its output, verbatim
 * from pyramid-cli (DOC-RENDERING there). Do not paraphrase. The version is the CLI's,
 * supplied by the MCP builder.
 */
export const instructions = (version: string): string =>
	`Pyramid MCP v${version} — drive the Pyramid project tracker. Rules: (1) You act as one user in ONE workspace (the key is workspace-pinned). (2) Inputs accept names/keys, not UUIDs; outputs are already hydrated to names. (3) RENDER tasks as a left-rail card, one field per line, no JSON: \`│ <KEY>\` / \`│ NAME: <title>\` / \`│ DESCRIPTION: <one line; truncate in lists>\` / \`│ <Stage>: <Status>\` — always show stage and status together as \`Stage: Status\`. (4) For a LIST ("get my work"), render one card per task SEPARATED BY A BLANK LINE so each reads as a distinct ticket — never let cards run together — with one-line descriptions; show the page, then say "showing N of M — ask for more"; NEVER auto-paginate. Full description + drill-in only for a single task. (5) Drill-in (comments, git PRs/commits) only when asked, for the named task. (6) Dates are UTC — render UTC-labeled or relative-with-label, never bare local. (7) On error, act on the \`code\` (don't parse the message): \`ambiguous_*\` → show candidates and ask; \`auth_*\` → tell the user to regenerate their key in Pyramid → Settings → API Keys. Never print raw JSON or an HTTP status to the user.`;

/** Register Pyramid's resources and prompts on a kit-built server. */
export function registerPyramidMcp(server: unknown, ctx: OpContext): void {
	registerResources(server as McpServer, ctx);
	registerPrompts(server as McpServer, ctx);
}
