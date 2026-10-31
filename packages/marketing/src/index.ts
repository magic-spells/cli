// @magic-spells/marketing — the Marketing product for the Magic CLI
// (COMPONENT-MARKETING-PACKAGE). R1 ships only its credential and session metadata, so
// `magic login` mints Marketing sessions and `magic whoami` / `magic logout` cover
// them. Commands arrive with the Marketing move in R4 (FEATURE-MARKETING-MOVE).
//
// Keys are `marketing_live_…`; test-mode `marketing_test_…` keys share the prefix
// and are accepted too.

import type { ProductModule } from '@magic-spells/kit';

export const marketing: ProductModule<null> = {
	id: 'marketing',
	title: 'Marketing',
	credential: 'marketing_',
	apiUrl: 'https://marketing.magicspells.io',
	keyHelp: 'Marketing → Settings → API keys',
	// Marketing serves its API under /api/v1 on the app host.
	sessions: { path: '/api/v1/cli/sessions' },
	load: async () => [],
	client: () => null,
};

export default marketing;
