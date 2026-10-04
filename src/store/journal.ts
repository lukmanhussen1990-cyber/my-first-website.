import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createSampleMemories } from '@/data/seed';
import type { Memory } from '@/types';
import { createId } from '@/utils/id';

import { arrayOr, persistOptions, recordOr } from './storage';

export type NewMemoryInput = Omit<Memory, 'id' | 'createdAt' | 'favorite'> & { favorite?: boolean };

interface JournalData {
  /** Newest first. */
  memories: Memory[];
}

export interface JournalStore extends JournalData {
  /** Prepends the memory (newest first) and returns its id. */
  addMemory(input: NewMemoryInput): string;
  updateMemory(id: string, patch: Partial<Omit<Memory, 'id' | 'createdAt'>>): void;
  /** Callers delete the memory's photo / audio files first (services/media). */
  removeMemory(id: string): void;
  toggleFavorite(id: string): void;
  /** Replaces memories with 3 illustrated photos, 1 note and 1 sealed "Future Me" letter. */
  seedSample(now?: Date): void;
  reset(): void;
}

const initialJournal = (): JournalData => ({ memories: [] });

function updateMemoryIn(memories: Memory[], id: string, update: (memory: Memory) => Memory) {
  return memories.map((memory) => (memory.id === id ? update(memory) : memory));
}

export const useJournalStore = create<JournalStore>()(
  persist(
    (set) => ({
      ...initialJournal(),

      addMemory({ favorite = false, ...input }) {
        const id = createId('mem_');
        const memory: Memory = { ...input, id, favorite, createdAt: new Date().toISOString() };
        set((state) => ({ memories: [memory, ...state.memories] }));
        return id;
      },

      updateMemory(id, patch) {
        set((state) => ({ memories: updateMemoryIn(state.memories, id, (memory) => ({ ...memory, ...patch })) }));
      },

      removeMemory(id) {
        set((state) => ({ memories: state.memories.filter((memory) => memory.id !== id) }));
      },

      toggleFavorite(id) {
        set((state) => ({
          memories: updateMemoryIn(state.memories, id, (memory) => ({ ...memory, favorite: !memory.favorite })),
        }));
      },

      seedSample(now = new Date()) {
        set({ memories: createSampleMemories(now) });
      },

      reset() {
        set(initialJournal());
      },
    }),
    persistOptions<JournalStore, JournalData>('journal', {
      partialize: ({ memories }) => ({ memories }),
      merge: (persisted, current) => ({
        ...current,
        memories: arrayOr(recordOr<JournalData>(persisted).memories, current.memories),
      }),
    }),
  ),
);
