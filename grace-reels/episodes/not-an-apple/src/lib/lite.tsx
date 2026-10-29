import {getInputProps} from 'remotion';

// "Lite" turns heavy effects off for the animatic (pass --props='{"lite":true}').
// Read from the input props directly so it also works inside the Three.js canvas tree.
let cached: boolean | null = null;
export const useRemotionLite = () => {
  if (cached === null) cached = Boolean((getInputProps() as {lite?: boolean}).lite);
  return cached;
};

export type Quality = {msaa: number; dpr: number; shadow: number; dof: boolean; rays: boolean; post: boolean};
let q: Quality | null = null;
// Render-quality knobs (overridable with --props for speed tests).
export const quality = (): Quality => {
  if (!q) {
    const p = (getInputProps() as {q?: Partial<Quality>}).q ?? {};
    q = {msaa: 0, dpr: 0.75, shadow: 1024, dof: true, rays: false, post: true, ...p};
  }
  return q;
};
