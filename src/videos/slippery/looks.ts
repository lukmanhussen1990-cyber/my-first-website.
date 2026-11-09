// Light presets for the slippery short, same fields as the bridge LightPreset (shade.ts two-tone world + cardShade
// characters), plus the background colour and a card gain (night shots darken the self-normalised character cards).
// az = degrees from the shot camera's forward axis (0 = backlight, +90 = screen right, 180 = behind the camera).
type C3 = [number, number, number];
export type Look = {
  az: number; el: number; lit: C3; shade: C3; lift: C3; lambert: number; sideK: number; term: number; sat: number;
  charTint: C3; charShade: number; charGrad: number; bodyGrad: number; sideTint: C3; cardGain: number;
  bg: string; fog: string; fogNear: number; fogFar: number; glow: number; night: boolean; grade: "day" | "golden";
};
export type LookId = "store" | "room" | "night" | "reef" | "reefNight";
const base = { lambert: 0.3, sideK: 0.9, term: 0.25, sat: 1.06, charShade: 0.9, charGrad: 0.06, bodyGrad: 0.18, glow: 0.25, night: false, grade: "day" as const };
export const LOOKS: Record<LookId, Look> = {
  store: { ...base, az: -140, el: 55, lit: [1.42, 1.4, 1.36], shade: [0.6, 0.64, 0.8], lift: [0.03, 0.05, 0.09],
    charTint: [0.97, 0.99, 1.0], sideTint: [0.92, 0.93, 0.98], cardGain: 1.03, bg: "#cfe9ee", fog: "#cfe9ee", fogNear: 20, fogFar: 140, glow: 0.55 },
  room: { ...base, az: -135, el: 52, lit: [1.5, 1.42, 1.3], shade: [0.62, 0.58, 0.68], lift: [0.05, 0.04, 0.06],
    charTint: [1.0, 0.96, 0.92], sideTint: [0.93, 0.91, 0.97], cardGain: 1.03, bg: "#f0e2c8", fog: "#f0e2c8", fogNear: 20, fogFar: 140 },
  night: { ...base, az: -150, el: 45, lit: [0.3, 0.36, 0.64], shade: [0.085, 0.1, 0.22], lift: [0.015, 0.02, 0.06],
    charTint: [0.62, 0.72, 1.0], sideTint: [0.85, 0.88, 1.0], cardGain: 0.5, bg: "#1b2a52", fog: "#1b2a52", fogNear: 20, fogFar: 140, glow: 1.1, night: true },
  reef: { ...base, az: -120, el: 65, lit: [1.15, 1.42, 1.45], shade: [0.36, 0.55, 0.72], lift: [0.02, 0.06, 0.1], sat: 1.12,
    charTint: [0.86, 1.0, 1.0], sideTint: [0.85, 0.95, 1.0], cardGain: 1.0, bg: "#36aecb", fog: "#36aecb", fogNear: 3, fogFar: 36 },
  reefNight: { ...base, az: -120, el: 60, lit: [0.38, 0.52, 0.95], shade: [0.1, 0.14, 0.32], lift: [0.01, 0.03, 0.08],
    charTint: [0.55, 0.7, 1.0], sideTint: [0.8, 0.85, 1.0], cardGain: 0.62, bg: "#0d2350", fog: "#0d2350", fogNear: 2.5, fogFar: 24, night: true },
};
