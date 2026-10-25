import { rngFrom } from "../lib/random";
import { drawFigure, FigureParts, FigureSpec } from "./draw";

// The series cast. Reuse these in every reel so characters always look the same.

export const SKIN = ["#c98d5f", "#b47a50", "#d6a06f", "#9d6943", "#a97350", "#8b5a3a", "#c2875a", "#e0b083"];

export const ABRAHAM: FigureSpec = {
  id: "abraham",
  skin: "#c2865a",
  robe: "#5f7088",
  robeShade: "#4a596e",
  trim: "#d9caa8",
  sash: "#b5915d",
  sleeve: "#62748c",
  hair: "#efeae0",
  beard: "long",
  beardColor: "#f1ede6",
  brows: "#f4f0ea",
  headwrap: "#e3dccb",
  headwrapBand: "#6b5340",
  sandal: "#5b3c26",
  props: { staff: true },
};

export const ISAAC: FigureSpec = {
  id: "isaac",
  build: "teen",
  skin: "#c98f60",
  robe: "#b6643c",
  robeShade: "#954f2f",
  trim: "#ecd9b4",
  sash: "#e8d6b0",
  hair: "#2b1c13",
  hairStyle: "curly",
  beard: "none",
  sandal: "#5b3c26",
  props: { wood: true },
};

export const SERVANT_A: FigureSpec = {
  id: "servantA",
  skin: "#a86f47",
  robe: "#6e7a46",
  robeShade: "#596337",
  trim: "#d8c9a0",
  sash: "#8a5a36",
  hair: "#20160f",
  beard: "short",
  headwrap: "#cfbf9e",
  headwrapBand: "#5a3f2b",
};

export const SERVANT_B: FigureSpec = {
  id: "servantB",
  skin: "#8f5c3b",
  robe: "#8b4a3b",
  robeShade: "#6f392d",
  trim: "#e2cfa8",
  sash: "#d1b27a",
  hair: "#1d140e",
  beard: "short",
  headwrap: "#e6dcc6",
};

export const JESUS: FigureSpec = {
  id: "jesus",
  skin: "#c08457",
  robe: "#ece4d3",
  robeShade: "#d4c9b2",
  trim: "#b08a5c",
  sash: "#9c7650",
  hair: "#4a2f1d",
  hairStyle: "long",
  beard: "short",
  beardColor: "#4a2f1d",
  rim: "#ffd38a",
  sandal: "#5b3c26",
  props: { beam: true },
};

const ROBES = [
  ["#b5523c", "#923f2e"], ["#3f6c7a", "#30545f"], ["#c99a45", "#a57b33"], ["#6d4f7d", "#553d62"],
  ["#5f7a4a", "#4b613a"], ["#e3d6bc", "#c9b997"], ["#8c5a3a", "#6f462d"], ["#4b5f8a", "#3b4a6d"],
  ["#c0704a", "#9d5a3a"], ["#7a8a60", "#626f4c"],
] as const;
const CLOTH = ["#e6dcc6", "#d9c7a0", "#c9b48a", "#f0e8d8", "#b9a27a", "#d6b88f"];

/** A varied crowd of men, women and children, seeded. */
export function crowdSpecs(n: number, seed: number): FigureSpec[] {
  const r = rngFrom(seed);
  return Array.from({ length: n }, (_, i) => {
    const kind = r.next();
    const woman = kind < 0.42;
    const child = !woman && kind > 0.86;
    const [robe, shade] = r.pick(ROBES);
    const skin = r.pick(SKIN);
    const spec: FigureSpec = {
      id: `crowd${seed}_${i}`,
      build: child ? "child" : r.next() < 0.15 ? "teen" : "adult",
      height: child ? r.range(1.05, 1.25) : woman ? r.range(1.55, 1.66) : r.range(1.66, 1.8),
      skin,
      robe,
      robeShade: shade,
      trim: r.next() < 0.6 ? r.pick(CLOTH) : undefined,
      sash: r.next() < 0.7 ? r.pick(["#8a5a36", "#d1b27a", "#5a3f2b", "#e8d6b0"]) : undefined,
      hair: r.pick(["#1d140e", "#2b1c13", "#3a2618", "#24170f"]),
      hairStyle: woman ? "long" : r.pick(["short", "curly", "short"] as const),
      beard: woman || child ? "none" : r.pick(["short", "none", "short", "long"] as const),
    };
    if (woman) spec.scarf = r.pick(["#d8c7a2", "#a8463a", "#3f6c7a", "#e9e0cc", "#c99a45", "#6d4f7d"]);
    else if (!child && r.next() < 0.55) {
      spec.headwrap = r.pick(CLOTH);
      if (r.next() < 0.5) spec.headwrapBand = "#5a3f2b";
    }
    return spec;
  });
}

const figureCache = new Map<string, FigureParts>();
/** Draw (once) and cache a figure's paper parts. */
export function figure(spec: FigureSpec, ppm = 650): FigureParts {
  const key = `${spec.id}@${ppm}`;
  let f = figureCache.get(key);
  if (!f) {
    f = drawFigure(spec, ppm);
    figureCache.set(key, f);
  }
  return f;
}
