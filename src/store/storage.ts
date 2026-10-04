import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

/** Schema version shared by every persisted store. Bump per store when its shape changes. */
export const STORE_VERSION = 1;

/** Prefix for every AsyncStorage key the app owns ("lastmile.app", "lastmile.planner", …). */
export const STORAGE_PREFIX = 'lastmile.';

export const storageKey = (store: string) => `${STORAGE_PREFIX}${store}`;

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
        return parsed && typeof parsed === 'object' && 'state' in parsed
          ? (parsed as StorageValue<S>)
          : null;
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

/**
 * Migration stub shared by the stores. Version 1 is the first schema, so any older
 * payload is passed through and the store's `merge` fills in missing fields.
 */
export function migratePersisted<P>(persisted: unknown, _version: number): P {
  return (persisted ?? {}) as P;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
