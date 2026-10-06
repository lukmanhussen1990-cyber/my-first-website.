import { create } from 'zustand';

export type ToastKind = 'achievement' | 'reward' | 'info' | 'error' | 'levelup';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
  /** achievement id when kind === 'achievement' */
  achievementId?: string;
  durationMs: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }) => void;
  dismiss: (id: number) => void;
}

let seq = 1;

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = seq++;
    const toast: Toast = { durationMs: 3200, ...t, id };
    set({ toasts: [...get().toasts.slice(-2), toast] });
    window.setTimeout(() => get().dismiss(id), toast.durationMs);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));

export const toast = (t: Parameters<ToastStore['push']>[0]) => useToasts.getState().push(t);
