// Module-level cache: heavy procedural geometry is built once per tab and reused by every frame.
const store = new Map<string, unknown>();

export const cached = <T>(key: string, build: () => T): T => {
	if (!store.has(key)) store.set(key, build());
	return store.get(key) as T;
};
