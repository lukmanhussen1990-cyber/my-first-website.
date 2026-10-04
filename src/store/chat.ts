import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ChatMessage } from '@/types';
import { createId } from '@/utils/id';

import { arrayOr, persistOptions, recordOr } from './storage';

/** Conversation length kept on device. */
export const MAX_CHAT_MESSAGES = 100;

interface ChatData {
  /** Oldest first. */
  messages: ChatMessage[];
}

export interface ChatStore extends ChatData {
  /** True while waiting for an assistant reply (not persisted). */
  pending: boolean;
  /** Appends a message (keeping the last 100) and returns its id. */
  addMessage(msg: Omit<ChatMessage, 'id' | 'createdAt'>): string;
  updateMessage(id: string, patch: Partial<ChatMessage>): void;
  setPending(pending: boolean): void;
  clear(): void;
}

const keepRecent = (messages: ChatMessage[]) =>
  messages.length > MAX_CHAT_MESSAGES ? messages.slice(-MAX_CHAT_MESSAGES) : messages;

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      messages: [],
      pending: false,

      addMessage(msg) {
        const id = createId('msg_');
        const message: ChatMessage = { ...msg, id, createdAt: new Date().toISOString() };
        set((state) => ({ messages: keepRecent([...state.messages, message]) }));
        return id;
      },

      updateMessage(id, patch) {
        set((state) => ({
          messages: state.messages.map((message) => (message.id === id ? { ...message, ...patch, id } : message)),
        }));
      },

      setPending(pending) {
        set({ pending });
      },

      clear() {
        set({ messages: [], pending: false });
      },
    }),
    persistOptions<ChatStore, ChatData>('chat', {
      partialize: ({ messages }) => ({ messages: keepRecent(messages) }),
      merge: (persisted, current) => ({
        ...current,
        messages: keepRecent(arrayOr(recordOr<ChatData>(persisted).messages, current.messages)),
      }),
    }),
  ),
);
