// @magic-spells/sites — the Sites product for the Magic CLI (COMPONENT-SITES-ADAPTER).
// R1 ships only its credential and session metadata, so `magic login` mints Sites
// sessions and `magic whoami` / `magic logout` cover them. Commands arrive with the
// engine adapter in R2 (FEATURE-SITES-ADAPTER).

import type { ProductModule } from '@magic-spells/kit';

export const sites: ProductModule<null> = {
	id: 'sites',
	title: 'Sites',
	credential: 'sites_',
	apiUrl: 'https://sites-api.magicspells.io',
	keyHelp: 'Sites → Settings → Access keys',
	sessions: { path: '/v1/cli/sessions' },
	load: async () => [],
	client: () => null,
};

export default sites;
