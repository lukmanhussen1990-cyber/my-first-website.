import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import {
  BEAM_MAX_DEG,
  BEAM_MIN_DEG,
  BEAM_PROFILES,
  emittedLumens,
  powerDrawWatts,
  BATTERY_WH,
  clamp01,
  type BeamMode,
} from '../lib/photometry';

export interface TorchState {
  on: boolean;
  /** Slider value 0..1 (perceptual). */
  brightness: number;
  /** Full beam cone angle in degrees. */
  beamAngle: number;
  mode: BeamMode;
  /** State of charge 0..1. */
  battery: number;
  charging: boolean;
  /** Incremented to ask the camera rig + torch to return to the default pose. */
  resetNonce: number;
  /** Message for the screen-reader live region. */
  announcement: string;
  /** True once the user has aimed, orbited or zoomed. */
  interacted: boolean;

  setOn: (on: boolean, source?: 'ui' | 'model' | 'keyboard' | 'intro') => void;
  toggle: (source?: 'ui' | 'model' | 'keyboard') => void;
  setBrightness: (value: number) => void;
  setBeamAngle: (deg: number) => void;
  setMode: (mode: BeamMode) => void;
  startCharging: () => void;
  tick: (dt: number) => void;
  requestReset: () => void;
  markInteracted: () => void;
  announce: (message: string) => void;
}

/** localStorage can throw (private mode, blocked storage); never let that break the app. */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* ignore */
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

const CHARGE_RATE_PER_SECOND = 0.22; // simulated fast-charge dock: ~4.5 s from empty

let announceSeq = 0;
/** Appends an invisible, changing suffix so repeated messages are still announced. */
const withSeq = (message: string) => `${message}${(announceSeq++ & 1) === 0 ? '' : '​'}`;

export const useTorch = create<TorchState>()(
  persist(
    (set, get) => ({
      on: false,
      brightness: 0.82,
      beamAngle: BEAM_PROFILES.standard.defaultAngle,
      mode: 'standard',
      battery: 0.92,
      charging: false,
      resetNonce: 0,
      announcement: '',
      interacted: false,

      setOn: (on, source = 'ui') => {
        const state = get();
        if (on === state.on) return;
        if (on && state.battery <= 0) {
          set({ announcement: withSeq('Battery empty. Recharge the torch to switch it on.') });
          return;
        }
        set({
          on,
          charging: on ? false : state.charging,
          announcement: source === 'intro' ? state.announcement : withSeq(on ? 'Flashlight on' : 'Flashlight off'),
        });
      },
      toggle: (source = 'ui') => get().setOn(!get().on, source),

      setBrightness: (value) => set({ brightness: clamp01(value) }),

      setBeamAngle: (deg) => set({ beamAngle: Math.min(BEAM_MAX_DEG, Math.max(BEAM_MIN_DEG, deg)) }),

      setMode: (mode) =>
        set({
          mode,
          beamAngle: BEAM_PROFILES[mode].defaultAngle,
          announcement: withSeq(`${BEAM_PROFILES[mode].label} beam, ${BEAM_PROFILES[mode].defaultAngle} degrees`),
        }),

      startCharging: () => {
        const state = get();
        if (state.battery >= 1) return;
        set({ charging: true, on: false, announcement: withSeq('Charging') });
      },

      tick: (dt) => {
        const state = get();
        if (state.charging) {
          const battery = Math.min(1, state.battery + CHARGE_RATE_PER_SECOND * dt);
          set({
            battery,
            charging: battery < 1,
            announcement: battery >= 1 ? withSeq('Battery fully charged') : state.announcement,
          });
          return;
        }
        if (!state.on) return;
        const lumens = emittedLumens(state.brightness, state.battery);
        const watts = powerDrawWatts(lumens);
        const battery = Math.max(0, state.battery - (watts * dt) / 3600 / BATTERY_WH);
        if (battery <= 0) {
          set({ battery: 0, on: false, announcement: withSeq('Battery depleted. The flashlight switched off.') });
        } else {
          set({ battery });
        }
      },

      requestReset: () => set((s) => ({ resetNonce: s.resetNonce + 1, announcement: withSeq('View reset') })),
      markInteracted: () => {
        if (!get().interacted) set({ interacted: true });
      },
      announce: (message) => set({ announcement: withSeq(message) }),
    }),
    {
      name: 'nyxen-tx1-settings',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ brightness: s.brightness, beamAngle: s.beamAngle, mode: s.mode }),
    },
  ),
);
