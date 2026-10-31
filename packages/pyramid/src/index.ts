// @magic-spells/pyramid — the Pyramid product for the Magic CLI (COMPONENT-PYRAMID-PACKAGE).
// Default export: the ProductModule the shell loads lazily for `magic pyramid …` and
// that `magic mcp` aggregates as `pyramid_*` tools. Never published on its own.

import type { ProductModule } from '@magic-spells/kit';

import { Resolver } from './cache/resolver.js';
import { PyramidClient } from './client/pyramid-client.js';
import { DEFAULT_API_URL, PYRAMID_CREDENTIAL } from './credential.js';
import { doctorChecks } from './doctor.js';
import { instructions, registerPyramidMcp } from './mcp/index.js';
import type { PyramidApi } from './operations/index.js';

export const pyramid: ProductModule<PyramidApi> = {
	...PYRAMID_CREDENTIAL,
	apiUrl: DEFAULT_API_URL,
	// `magic login` mints workspace keys here from the Account grant (API-PYRAMID-CLI-SESSIONS).
	sessions: { path: '/v1/cli/sessions' },
	// The operations graph loads only when a Pyramid command runs.
	load: async () => (await import('./operations/index.js')).operations,
	client(session, config) {
		const api = new PyramidClient({
			apiKey: session.key,
			baseUrl: config.products.pyramid!.apiUrl,
		});
		return { api, resolver: new Resolver(api) };
	},
	// `--project` stays a Pyramid flag, usable anywhere in argv (pyramid-cli's global).
	globalFlags: ['project'],
	doctor: doctorChecks,
	mcp: { instructions, register: registerPyramidMcp },
};

export default pyramid;

export { PYRAMID_CREDENTIAL, DEFAULT_API_URL } from './credential.js';
export type { PyramidApi } from './operations/index.js';
