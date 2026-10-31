// Pyramid's identity in the family: id, display name, key prefix, API URL.

export const PYRAMID_CREDENTIAL = {
	id: 'pyramid',
	title: 'Pyramid',
	credential: 'pyramid_',
	keyHelp: 'Pyramid → Settings → API Keys',
} as const;

/** The API lives at the `api.` subdomain; the bare host serves the web app. */
export const DEFAULT_API_URL = 'https://api.pyramid.magicspells.io';
