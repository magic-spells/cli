// Defensive readers for raw API rows. Products hydrate with these and never trust a
// response shape they have not checked.

/** The value as a plain record, or an empty one. */
export function rec(v: unknown): Record<string, unknown> {
	return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

/** A non-empty string, else undefined. */
export function readStr(v: unknown): string | undefined {
	return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/** A field of a raw object, any type, else undefined. */
export function readField(obj: unknown, key: string): unknown {
	return obj && typeof obj === 'object' && key in obj
		? (obj as Record<string, unknown>)[key]
		: undefined;
}
