// A small TTL cache (COMPONENT-KIT "cache"). Products build their resolvers on it;
// name resolution itself stays in each product.

export class TtlCache<V> {
	private readonly entries = new Map<string, { value: V; expiresAt: number }>();

	constructor(
		private readonly ttlMs: number,
		private readonly now: () => number = () => Date.now()
	) {}

	get(key: string): V | undefined {
		const hit = this.entries.get(key);
		if (!hit) return undefined;
		if (hit.expiresAt > this.now()) return hit.value;
		this.entries.delete(key);
		return undefined;
	}

	set(key: string, value: V): void {
		this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
	}

	delete(key: string): void {
		this.entries.delete(key);
	}

	clear(): void {
		this.entries.clear();
	}

	/** Return the live entry, or load, store and return a fresh one. */
	async getOrLoad(key: string, load: () => Promise<V>): Promise<V> {
		const hit = this.get(key);
		if (hit !== undefined) return hit;
		const value = await load();
		this.set(key, value);
		return value;
	}
}
