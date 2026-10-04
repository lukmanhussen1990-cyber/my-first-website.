import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createDefaultChecklist } from '@/data/seed';
import type { ChecklistCategory, ChecklistItem } from '@/types';
import { createId } from '@/utils/id';

import { arrayOr, persistOptions, recordOr } from './storage';

interface TravelData {
  items: ChecklistItem[];
}

export interface TravelStore extends TravelData {
  addItem(input: { title: string; category: ChecklistCategory }): string;
  toggleItem(id: string): void;
  renameItem(id: string, title: string): void;
  removeItem(id: string): void;
  uncheckAll(): void;
  /**
   * Adds the default pre-travel checklist (tickets, clothes, ID & hall ticket, chargers,
   * gifts, medicines, …). Idempotent: defaults already on the list (same title) are skipped,
   * so it never duplicates or wipes the student's own items.
   */
  seedDefaults(): void;
  reset(): void;
}

const initialTravel = (): TravelData => ({ items: [] });

const normalizeTitle = (title: string) => title.trim().toLowerCase();

function updateItemIn(items: ChecklistItem[], id: string, update: (item: ChecklistItem) => ChecklistItem) {
  return items.map((item) => (item.id === id ? update(item) : item));
}

export const useTravelStore = create<TravelStore>()(
  persist(
    (set) => ({
      ...initialTravel(),

      addItem({ title, category }) {
        const id = createId('item_');
        const item: ChecklistItem = {
          id,
          title: title.trim(),
          category,
          done: false,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ items: [...state.items, item] }));
        return id;
      },

      toggleItem(id) {
        set((state) => ({ items: updateItemIn(state.items, id, (item) => ({ ...item, done: !item.done })) }));
      },

      renameItem(id, title) {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((state) => ({ items: updateItemIn(state.items, id, (item) => ({ ...item, title: trimmed })) }));
      },

      removeItem(id) {
        set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
      },

      uncheckAll() {
        set((state) => ({ items: state.items.map((item) => (item.done ? { ...item, done: false } : item)) }));
      },

      seedDefaults() {
        set((state) => {
          const existing = new Set(state.items.map((item) => normalizeTitle(item.title)));
          const missing = createDefaultChecklist(new Date()).filter(
            (item) => !existing.has(normalizeTitle(item.title)),
          );
          return missing.length ? { items: [...state.items, ...missing] } : state;
        });
      },

      reset() {
        set(initialTravel());
      },
    }),
    persistOptions<TravelStore, TravelData>('travel', {
      partialize: ({ items }) => ({ items }),
      merge: (persisted, current) => ({
        ...current,
        items: arrayOr(recordOr<TravelData>(persisted).items, current.items),
      }),
    }),
  ),
);
