import { clamp, lerp, mixHex } from "./math";

// A mood is the whole colour/light state of a shot. Scenes ask for a mood at time t and
// blend between moods, so colour always flows smoothly from scene to scene.

export type Mood = {
  skyTop: string;
  skyHorizon: string;
  skyGlow: string; // colour of the glow around the sun direction
  fog: string;
  fogNear: number;
  fogFar: number;
  sun: string;
  sunIntensity: number;
  sunAz: number; // degrees, 0 = +z (towards default camera side), 90 = +x
  sunEl: number; // degrees above horizon
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  exposure: number;
  bloom: number; // strength
  bloomThreshold: number;
  tilt: number; // tilt-shift blur strength (0..1)
  vignette: number; // 0..1
  grade: string; // CSS colour laid over the frame (soft-light)
  gradeAmount: number;
  text: "light" | "dark"; // caption style for this mood (light = ink text on cream scrim)
};

export const MOODS: Record<string, Mood> = {
  dawnCool: {
    skyTop: "#5c7aa6", skyHorizon: "#e9c3a2", skyGlow: "#ffd4a3", fog: "#b9bccb", fogNear: 40, fogFar: 260,
    sun: "#ffc79a", sunIntensity: 2.7, sunAz: 120, sunEl: 9,
    hemiSky: "#9db4d8", hemiGround: "#7a6250", hemiIntensity: 1.15, exposure: 1.12,
    bloom: 0.55, bloomThreshold: 0.95, tilt: 0.85, vignette: 0.35, grade: "#6f8fbf", gradeAmount: 0.1, text: "dark",
  },
  dawnGold: {
    skyTop: "#d9a56e", skyHorizon: "#ffd9a6", skyGlow: "#fff0c9", fog: "#ecc79b", fogNear: 40, fogFar: 260,
    sun: "#ffc678", sunIntensity: 3.5, sunAz: 120, sunEl: 13,
    hemiSky: "#f5d3a6", hemiGround: "#8b6a4c", hemiIntensity: 1.0, exposure: 1.04,
    bloom: 0.6, bloomThreshold: 0.93, tilt: 0.85, vignette: 0.32, grade: "#ffb86b", gradeAmount: 0.08, text: "dark",
  },
  night: {
    skyTop: "#08142b", skyHorizon: "#22355a", skyGlow: "#5e78b0", fog: "#16223b", fogNear: 30, fogFar: 200,
    sun: "#9eb5ff", sunIntensity: 0.8, sunAz: -60, sunEl: 35,
    hemiSky: "#2b4372", hemiGround: "#0e1018", hemiIntensity: 0.7, exposure: 1.0,
    bloom: 0.9, bloomThreshold: 0.86, tilt: 0.9, vignette: 0.5, grade: "#1d3260", gradeAmount: 0.12, text: "dark",
  },
  journey: {
    skyTop: "#d8b27d", skyHorizon: "#f6dfb2", skyGlow: "#fff2d0", fog: "#ecd2a3", fogNear: 60, fogFar: 330,
    sun: "#ffe0aa", sunIntensity: 3.0, sunAz: 140, sunEl: 32,
    hemiSky: "#f3dcb2", hemiGround: "#a07a50", hemiIntensity: 1.2, exposure: 1.0,
    bloom: 0.45, bloomThreshold: 0.98, tilt: 0.85, vignette: 0.3, grade: "#e3a35a", gradeAmount: 0.08, text: "dark",
  },
  climb: {
    skyTop: "#c98d5c", skyHorizon: "#f3c995", skyGlow: "#ffe2b4", fog: "#e2b88f", fogNear: 40, fogFar: 260,
    sun: "#ffb56a", sunIntensity: 3.2, sunAz: 105, sunEl: 15,
    hemiSky: "#efc59a", hemiGround: "#7d5a40", hemiIntensity: 1.05, exposure: 1.0,
    bloom: 0.55, bloomThreshold: 0.95, tilt: 0.85, vignette: 0.36, grade: "#d9823f", gradeAmount: 0.09, text: "dark",
  },
  glory: {
    skyTop: "#f1d7a6", skyHorizon: "#fff6e2", skyGlow: "#ffffff", fog: "#fbe9c8", fogNear: 40, fogFar: 240,
    sun: "#fff1d2", sunIntensity: 3.0, sunAz: 100, sunEl: 40,
    hemiSky: "#fff3dc", hemiGround: "#a3896a", hemiIntensity: 1.2, exposure: 1.0,
    bloom: 0.7, bloomThreshold: 0.9, tilt: 0.8, vignette: 0.3, grade: "#ffe2a0", gradeAmount: 0.1, text: "dark",
  },
  golgotha: {
    skyTop: "#30363f", skyHorizon: "#6a6e74", skyGlow: "#8c939c", fog: "#5b5f66", fogNear: 30, fogFar: 220,
    sun: "#c4cdd8", sunIntensity: 0.9, sunAz: -40, sunEl: 30,
    hemiSky: "#7b8490", hemiGround: "#2b2a2a", hemiIntensity: 1.0, exposure: 0.96,
    bloom: 0.5, bloomThreshold: 1.0, tilt: 0.85, vignette: 0.5, grade: "#4a5568", gradeAmount: 0.14, text: "dark",
  },
  lamb: {
    skyTop: "#a8794a", skyHorizon: "#ffd69c", skyGlow: "#fff4d6", fog: "#eec38e", fogNear: 40, fogFar: 240,
    sun: "#ffd08c", sunIntensity: 3.0, sunAz: 60, sunEl: 38,
    hemiSky: "#ffdcaa", hemiGround: "#7a5a3e", hemiIntensity: 1.15, exposure: 1.0,
    bloom: 0.72, bloomThreshold: 0.9, tilt: 0.8, vignette: 0.32, grade: "#ffbd68", gradeAmount: 0.1, text: "dark",
  },
};

const NUM_KEYS = ["fogNear", "fogFar", "sunIntensity", "sunAz", "sunEl", "hemiIntensity", "exposure", "bloom", "bloomThreshold", "tilt", "vignette", "gradeAmount"] as const;
const COL_KEYS = ["skyTop", "skyHorizon", "skyGlow", "fog", "sun", "hemiSky", "hemiGround", "grade"] as const;

export function blendMood(a: Mood, b: Mood, k: number): Mood {
  const t = clamp(k);
  const out = { ...a } as Mood;
  for (const key of NUM_KEYS) (out as Record<string, unknown>)[key] = lerp(a[key], b[key], t);
  for (const key of COL_KEYS) (out as Record<string, unknown>)[key] = mixHex(a[key], b[key], t);
  out.text = t < 0.5 ? a.text : b.text;
  return out;
}

export function withOverrides(m: Mood, o: Partial<Mood>): Mood {
  return { ...m, ...o };
}
