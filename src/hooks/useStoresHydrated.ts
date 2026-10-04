import { useSyncExternalStore } from 'react';

// Side-effect import: creating the stores is what starts their rehydration.
import '@/store/app';
import { areStoresHydrated, subscribeHydration } from '@/store/storage';

const getSnapshot = () => areStoresHydrated();
const getServerSnapshot = () => false;

/** True once every persisted store (app, planner, travel, journal, chat) has rehydrated. */
export function useStoresHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, getSnapshot, getServerSnapshot);
}
