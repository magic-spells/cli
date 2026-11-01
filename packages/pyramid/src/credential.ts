// Pyramid's identity in the family: id, display name, key prefix, API URL.

export const PYRAMID_CREDENTIAL = {
	id: 'pyramid',
	title: 'Pyramid',
	credential: 'pyramid_',
	keyHelp: 'Pyramid → Settings → API Keys',
} as const;

/** Pyramid serves its API on the web host. */
export const DEFAULT_API_URL = 'https://pyramid.magicspells.io';
