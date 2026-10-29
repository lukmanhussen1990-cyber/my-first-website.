import { create } from 'zustand';
import { initialTier, type QualityTier } from '../scene/quality';

interface UiState {
  /** Height (px) of UI covering the bottom of the viewport; the camera frames the torch above it. */
  insetBottom: number;
  quality: QualityTier;
  /** 0..1 refinement of the device pixel ratio inside the current tier. */
  dprFactor: number;
  fullscreen: boolean;
  shortcutsOpen: boolean;
  /** WebGL context lost or unavailable. */
  glError: string | null;
  setInsetBottom: (px: number) => void;
  setQuality: (tier: QualityTier) => void;
  setDprFactor: (f: number) => void;
  setFullscreen: (v: boolean) => void;
  setShortcutsOpen: (v: boolean) => void;
  setGlError: (message: string | null) => void;
}

export const useUi = create<UiState>()((set) => ({
  insetBottom: 0,
  quality: initialTier(),
  dprFactor: 1,
  fullscreen: false,
  shortcutsOpen: false,
  glError: null,
  setInsetBottom: (px) => set({ insetBottom: Math.round(px) }),
  setQuality: (quality) => set({ quality }),
  setDprFactor: (dprFactor) => set({ dprFactor }),
  setFullscreen: (fullscreen) => set({ fullscreen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setGlError: (glError) => set({ glError }),
}));
