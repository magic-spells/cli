// The products `magic` knows, loaded lazily so `magic pyramid …` never loads another
// product's code (COMPONENT-SHELL "product dispatch"). Add a product here and in
// package.json; everything else derives from its ProductModule.

import type { ProductModule } from '@magic-spells/kit';

export interface ProductEntry {
	id: string;
	title: string;
	load: () => Promise<ProductModule>;
}

export const PRODUCTS: ProductEntry[] = [
	{
		id: 'pyramid',
		title: 'Pyramid — projects and tasks',
		load: async () => (await import('@magic-spells/pyramid')).default,
	},
];
