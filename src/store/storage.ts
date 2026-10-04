import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistOptions, PersistStorage, StorageValue } from 'zustand/middleware';

/** Schema version shared by every persisted store. Bump per store when its shape changes. */
export const STORE_VERSION = 1;

export type PersistedStoreName = 'app' | 'planner' | 'travel' | 'journal' | 'chat';

export const PERSISTED_STORES: readonly PersistedStoreName[] = ['app', 'planner', 'travel', 'journal', 'chat'];

/** AsyncStorage key for a store: "lastmile.app", "lastmile.planner", … */
export const storageKey = (store: PersistedStoreName) => `lastmile.${store}`;

function warn(action: string, name: string, error: unknown) {
  if (__DEV__) console.warn(`[storage] ${action} "${name}" failed`, error);
}

/**
 * JSON persist storage on top of AsyncStorage — the `createJSONStorage(() => AsyncStorage)`
 * contract, hardened so storage can never take the app down:
 *  - reads that throw (no native module, web static export, quota) or hold corrupt
 *    JSON resolve to `null`, so hydration still completes with the defaults;
 *  - failed writes are logged in dev and swallowed instead of becoming unhandled rejections.
 */
export function createPersistStorage<S>(): PersistStorage<S, Promise<void>> {
  return {
    async getItem(name) {
      try {
        const raw = await AsyncStorage.getItem(name);
        if (raw == null) return null;
        const parsed: unknown = JSON.parse(raw);
        return isRecord(parsed) && 'state' in parsed ? (parsed as StorageValue<S>) : null;
      } catch (error) {
        warn('read', name, error);
        return null;
      }
    },
    async setItem(name, value) {
      try {
        await AsyncStorage.setItem(name, JSON.stringify(value));
      } catch (error) {
        warn('write', name, error);
      }
    },
    async removeItem(name) {
      try {
        await AsyncStorage.removeItem(name);
      } catch (error) {
        warn('remove', name, error);
      }
    },
  };
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `value` when it is a plain object, else `{}` — guards spreads of untrusted persisted data. */
export const recordOr = <T extends object>(value: unknown): Partial<T> =>
  isRecord(value) ? (value as Partial<T>) : {};

/** `value` when it is an array, else `fallback`. */
export const arrayOr = <T>(value: unknown, fallback: T[]): T[] => (Array.isArray(value) ? (value as T[]) : fallback);

/* ------------------------------------------------------------------ */
/* Hydration tracking                                                  */
/* ------------------------------------------------------------------ */

const hydratedStores = new Set<PersistedStoreName>();
const hydrationListeners = new Set<() => void>();

/**
 * Called from each store's `onRehydrateStorage` callback, which zustand runs after a
 * successful rehydration *and* after a failed one — unlike `persist.hasHydrated()`,
 * which stays false on error and would keep the splash screen up forever.
 */
export function markStoreHydrated(store: PersistedStoreName) {
  if (hydratedStores.has(store)) return;
  hydratedStores.add(store);
  hydrationListeners.forEach((listener) => listener());
}

export function isStoreHydrated(store: PersistedStoreName): boolean {
  return hydratedStores.has(store);
}

export function areStoresHydrated(stores: readonly PersistedStoreName[] = PERSISTED_STORES): boolean {
  return stores.every((store) => hydratedStores.has(store));
}

/** Notifies `listener` whenever another store finishes hydrating. Returns an unsubscribe. */
export function subscribeHydration(listener: () => void): () => void {
  hydrationListeners.add(listener);
  return () => {
    hydrationListeners.delete(listener);
  };
}

/* ------------------------------------------------------------------ */
/* Shared persist options                                              */
/* ------------------------------------------------------------------ */

interface StorePersistConfig<S, P extends object> {
  /** Picks the persisted fields (drop transient ones such as `hydrated` / `pending`). */
  partialize: (state: S) => P;
  /** Custom merge of the stored payload into the initial state (default: shallow merge). */
  merge?: (persisted: unknown, current: S) => S;
  /** Extra work once rehydration has finished (successfully or not). */
  onHydrated?: () => void;
}

/**
 * `persist` options every store shares: key `lastmile.<store>`, AsyncStorage JSON
 * storage, version 1, a migrate stub and hydration tracking.
 */
export function persistOptions<S, P extends object>(
  store: PersistedStoreName,
  { partialize, merge, onHydrated }: StorePersistConfig<S, P>,
): PersistOptions<S, P> {
  return {
    name: storageKey(store),
    storage: createPersistStorage<P>(),
    version: STORE_VERSION,
    partialize,
    ...(merge ? { merge } : null),
    // v1 is the first schema: older payloads pass through and `merge` fills the gaps.
    migrate: (persisted) => recordOr<P>(persisted) as P,
    onRehydrateStorage: () => (_state, error) => {
      if (error) warn('rehydrate', storageKey(store), error);
      onHydrated?.();
      markStoreHydrated(store);
    },
  };
}
