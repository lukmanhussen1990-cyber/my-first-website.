import { create } from 'zustand';

export interface Settings {
  sound: boolean; // UI sound effects
  music: boolean; // ambient soundscape
  haptics: boolean;
  reduceMotion: boolean;
  volume: number; // 0..1 master
}

const KEY = 'bt.settings';

const DEFAULTS: Settings = {
  sound: true,
  music: true,
  haptics: true,
  reduceMotion: false,
  volume: 0.8,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* storage blocked — use defaults */
  }
  const prefersReduced =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { ...DEFAULTS, reduceMotion: prefersReduced };
}

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...load(),
  set: (patch) => {
    set(patch);
    const { set: _omit, ...plain } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify(plain));
    } catch {
      /* ignore */
    }
  },
}));

/** Non-React accessor for services (audio, haptics). */
export const getSettings = (): Settings => useSettings.getState();
