/*
 * Session store: who is playing (account, guest or nobody) and the auth
 * actions screens call. Progress hydration is chained here so every screen
 * behind the auth guard can assume `useGame().progress` is loaded.
 */
import { create } from 'zustand';
import {
  GUEST_ID,
  deleteAccount as deleteAccountSvc,
  isGuestActive,
  login as loginSvc,
  logout as logoutSvc,
  registerAccount,
  restoreSession,
  startGuest,
  type AccountPublic,
} from '../services/auth';
import { deleteProgress, loadProgress } from '../services/db';
import { useGame } from './game';

export type SessionStatus = 'booting' | 'signedOut' | 'guest' | 'user';

interface SessionStore {
  status: SessionStatus;
  user: AccountPublic | null;
  boot: () => Promise<void>;
  register: (username: string, password: string) => Promise<{ carriedGuestProgress: boolean }>;
  login: (username: string, password: string, remember: boolean) => Promise<void>;
  playAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

export const useSession = create<SessionStore>((set, get) => ({
  status: 'booting',
  user: null,

  boot: async () => {
    const user = await restoreSession();
    if (user) {
      await useGame.getState().hydrate(user.id, user.username);
      set({ status: 'user', user });
      return;
    }
    if (isGuestActive()) {
      await useGame.getState().hydrate(GUEST_ID, 'Guest');
      set({ status: 'guest', user: null });
      return;
    }
    set({ status: 'signedOut', user: null });
  },

  register: async (username, password) => {
    const wasGuest = get().status === 'guest';
    const guestProgress = wasGuest ? await loadProgress(GUEST_ID) : undefined;
    const user = await registerAccount(username, password);
    let carried = false;
    if (guestProgress && guestProgress.gamesPlayed > 0) {
      await useGame.getState().adopt(user.id, { ...guestProgress, playerName: user.username });
      await deleteProgress(GUEST_ID);
      carried = true;
    } else {
      await useGame.getState().hydrate(user.id, user.username);
    }
    set({ status: 'user', user });
    return { carriedGuestProgress: carried };
  },

  login: async (username, password, remember) => {
    const user = await loginSvc(username, password, remember);
    await useGame.getState().hydrate(user.id, user.username);
    set({ status: 'user', user });
  },

  playAsGuest: async () => {
    startGuest();
    await useGame.getState().hydrate(GUEST_ID, 'Guest');
    set({ status: 'guest', user: null });
  },

  logout: async () => {
    await logoutSvc();
    useGame.getState().clear();
    set({ status: 'signedOut', user: null });
  },

  deleteAccount: async (password) => {
    const { user, status } = get();
    if (status === 'guest') {
      await deleteProgress(GUEST_ID);
      await logoutSvc();
    } else if (user) {
      await deleteAccountSvc(user.id, password);
    }
    useGame.getState().clear();
    set({ status: 'signedOut', user: null });
  },
}));
