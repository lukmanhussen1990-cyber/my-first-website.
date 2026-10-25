// Paper-cut people: every figure is drawn from flat parts (head, robe, two arms, two legs, props)
// on canvases. Coordinates are metres in "figure space": y up, feet at y = 0, facing +x.

export type Build = "adult" | "teen" | "child";
export type HairStyle = "short" | "curly" | "long" | "bald" | "none";

export type FigureSpec = {
  id: string;
  build?: Build;
  height?: number; // metres (default by build)
  skin: string;
  robe: string;
  robeShade?: string; // back-side tone of the robe
  trim?: string; // hem / neck trim
  sash?: string;
  sleeve?: string; // defaults to robe
  hair?: string;
  hairStyle?: HairStyle;
  beard?: "none" | "short" | "long";
  beardColor?: string;
  brows?: string;
  headwrap?: string; // cloth colour (keffiyeh-like) or undefined
  headwrapBand?: string;
  scarf?: string; // women's head scarf colour
  sandal?: string;
  rim?: string; // warm rim light colour drawn on the edge facing back-light
  props?: { staff?: boolean; wood?: boolean; beam?: boolean };
};

export type PartName = "legBack" | "legFront" | "body" | "armBack" | "armFront" | "head" | "headBlink" | "staff" | "wood" | "beam";
export type Part = { canvas: HTMLCanvasElement; box: [number, number, number, number]; pivot: [number, number] };
export type FigureParts = { spec: FigureSpec; height: number; parts: Partial<Record<PartName, Part>>; anchors: Record<string, [number, number]> };

const OUTLINE = "#2a1f18";
const LINE = 0.0095;

const darken = (hex: string, k: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
};

function canvasFor(box: [number, number, number, number], ppm: number) {
  const [x0, y0, x1, y1] = box;
  const c = document.createElement("canvas");
  c.width = Math.ceil((x1 - x0) * ppm);
  c.height = Math.ceil((y1 - y0) * ppm);
  const ctx = c.getContext("2d")!;
  ctx.setTransform(ppm, 0, 0, -ppm, -x0 * ppm, y1 * ppm);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  return { c, ctx };
}

type Ctx = CanvasRenderingContext2D;
const fillStroke = (ctx: Ctx, fill: string, line = LINE) => {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = line;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
};

function proportions(spec: FigureSpec) {
  const build = spec.build ?? "adult";
  const H = spec.height ?? (build === "adult" ? 1.72 : build === "teen" ? 1.58 : 1.18);
  const s = H / 1.72;
  const slim = build === "adult" ? 1 : build === "teen" ? 0.88 : 0.9;
  return { H, s, slim, build };
}

// ------------------------------------------------------------------ parts

function drawLeg(spec: FigureSpec, ppm: number, back: boolean): Part {
  const { s } = proportions(spec);
  const hipY = 0.93 * s;
  const box: [number, number, number, number] = [-0.1 * s, 0, 0.16 * s, hipY + 0.03 * s];
  const { c, ctx } = canvasFor(box, ppm);
  const skin = back ? darken(spec.skin, 0.84) : spec.skin;
  // leg: tapered from thigh to ankle
  ctx.beginPath();
  ctx.moveTo(-0.045 * s, hipY);
  ctx.lineTo(0.05 * s, hipY);
  ctx.lineTo(0.03 * s, 0.07 * s);
  ctx.lineTo(-0.02 * s, 0.07 * s);
  ctx.closePath();
  fillStroke(ctx, skin);
  // sandal / foot
  ctx.beginPath();
  ctx.moveTo(-0.035 * s, 0.0);
  ctx.lineTo(0.125 * s, 0.0);
  ctx.quadraticCurveTo(0.135 * s, 0.035 * s, 0.08 * s, 0.045 * s);
  ctx.lineTo(0.02 * s, 0.085 * s);
  ctx.lineTo(-0.03 * s, 0.08 * s);
  ctx.closePath();
  fillStroke(ctx, skin);
  ctx.beginPath();
  ctx.moveTo(-0.04 * s, 0.0);
  ctx.lineTo(0.13 * s, 0.0);
  ctx.lineTo(0.13 * s, 0.018 * s);
  ctx.lineTo(-0.04 * s, 0.018 * s);
  ctx.closePath();
  fillStroke(ctx, spec.sandal ?? "#5a3b25");
  ctx.beginPath();
  ctx.moveTo(0.005 * s, 0.07 * s);
  ctx.lineTo(0.06 * s, 0.03 * s);
  ctx.lineWidth = LINE * 1.2;
  ctx.strokeStyle = spec.sandal ?? "#5a3b25";
  ctx.stroke();
  return { canvas: c, box, pivot: [0, hipY] };
}

function robePath(ctx: Ctx, s: number, w: number) {
  // shoulders round, chest slightly forward, flares to the hem
  ctx.beginPath();
  ctx.moveTo(-0.13 * w * s, 1.405 * s);
  ctx.quadraticCurveTo(0.0, 1.455 * s, 0.13 * w * s, 1.405 * s);
  ctx.quadraticCurveTo(0.175 * w * s, 1.33 * s, 0.165 * w * s, 1.15 * s);
  ctx.quadraticCurveTo(0.175 * w * s, 0.6 * s, 0.215 * w * s, 0.215 * s);
  ctx.quadraticCurveTo(0.03 * s, 0.185 * s, -0.2 * w * s, 0.205 * s);
  ctx.quadraticCurveTo(-0.17 * w * s, 0.6 * s, -0.165 * w * s, 1.12 * s);
  ctx.quadraticCurveTo(-0.17 * w * s, 1.33 * s, -0.13 * w * s, 1.405 * s);
  ctx.closePath();
}

function drawBody(spec: FigureSpec, ppm: number): Part {
  const { s, slim } = proportions(spec);
  const w = slim;
  const box: [number, number, number, number] = [-0.25 * s, 0.17 * s, 0.27 * s, 1.5 * s];
  const { c, ctx } = canvasFor(box, ppm);
  // neck
  ctx.beginPath();
  ctx.moveTo(-0.035 * s, 1.38 * s);
  ctx.lineTo(0.045 * s, 1.38 * s);
  ctx.lineTo(0.04 * s, 1.49 * s);
  ctx.lineTo(-0.03 * s, 1.49 * s);
  ctx.closePath();
  fillStroke(ctx, darken(spec.skin, 0.9));
  // robe base
  robePath(ctx, s, w);
  fillStroke(ctx, spec.robe);
  // back-side shade (flat second tone), clipped to the robe
  ctx.save();
  robePath(ctx, s, w);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(-0.3 * s, 1.5 * s);
  ctx.lineTo(-0.045 * s, 1.5 * s);
  ctx.quadraticCurveTo(-0.08 * s, 0.8 * s, -0.02 * s, 0.15 * s);
  ctx.lineTo(-0.3 * s, 0.15 * s);
  ctx.closePath();
  ctx.fillStyle = spec.robeShade ?? darken(spec.robe, 0.82);
  ctx.fill();
  // hem trim
  if (spec.trim) {
    ctx.beginPath();
    ctx.moveTo(-0.3 * s, 0.205 * s);
    ctx.lineTo(0.3 * s, 0.215 * s);
    ctx.lineTo(0.3 * s, 0.255 * s);
    ctx.quadraticCurveTo(0.03 * s, 0.228 * s, -0.3 * s, 0.245 * s);
    ctx.closePath();
    ctx.fillStyle = spec.trim;
    ctx.fill();
    // vertical stripe
    ctx.beginPath();
    ctx.moveTo(0.045 * s, 1.43 * s);
    ctx.lineTo(0.07 * s, 1.43 * s);
    ctx.quadraticCurveTo(0.09 * s, 0.8 * s, 0.11 * s, 0.22 * s);
    ctx.lineTo(0.085 * s, 0.22 * s);
    ctx.quadraticCurveTo(0.066 * s, 0.8 * s, 0.045 * s, 1.43 * s);
    ctx.closePath();
    ctx.fillStyle = spec.trim;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // rim light along the back edge
  if (spec.rim) {
    ctx.beginPath();
    ctx.moveTo(-0.13 * w * s, 1.405 * s);
    ctx.quadraticCurveTo(-0.17 * w * s, 1.33 * s, -0.165 * w * s, 1.12 * s);
    ctx.quadraticCurveTo(-0.17 * w * s, 0.6 * s, -0.2 * w * s, 0.205 * s);
    ctx.lineWidth = 0.022 * s;
    ctx.strokeStyle = spec.rim;
    ctx.stroke();
  }
  ctx.restore();
  // sash
  if (spec.sash) {
    ctx.beginPath();
    ctx.moveTo(-0.172 * w * s, 0.9 * s);
    ctx.quadraticCurveTo(0.0, 0.88 * s, 0.172 * w * s, 0.9 * s);
    ctx.lineTo(0.17 * w * s, 0.97 * s);
    ctx.quadraticCurveTo(0.0, 0.955 * s, -0.168 * w * s, 0.97 * s);
    ctx.closePath();
    fillStroke(ctx, spec.sash, LINE * 0.8);
    // hanging sash end
    ctx.beginPath();
    ctx.moveTo(0.1 * s, 0.9 * s);
    ctx.lineTo(0.13 * s, 0.72 * s);
    ctx.lineTo(0.09 * s, 0.73 * s);
    ctx.lineTo(0.075 * s, 0.9 * s);
    ctx.closePath();
    fillStroke(ctx, spec.sash, LINE * 0.8);
  }
  // re-stroke the silhouette so the outline sits on top
  robePath(ctx, s, w);
  ctx.lineWidth = LINE;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  return { canvas: c, box, pivot: [0, 0.93 * s] };
}

function drawArm(spec: FigureSpec, ppm: number, back: boolean): Part {
  const { s } = proportions(spec);
  const sy = 1.39 * s;
  const box: [number, number, number, number] = [-0.075 * s, 0.84 * s, 0.085 * s, 1.445 * s];
  const { c, ctx } = canvasFor(box, ppm);
  const sleeve = spec.sleeve ?? spec.robe;
  const col = back ? spec.robeShade ?? darken(sleeve, 0.8) : sleeve;
  // sleeve: wide at the shoulder, cuff at the wrist
  ctx.beginPath();
  ctx.moveTo(-0.05 * s, sy + 0.035 * s);
  ctx.quadraticCurveTo(0.01 * s, sy + 0.06 * s, 0.055 * s, sy + 0.02 * s);
  ctx.lineTo(0.05 * s, 0.98 * s);
  ctx.lineTo(-0.035 * s, 0.975 * s);
  ctx.closePath();
  fillStroke(ctx, col);
  if (spec.trim) {
    ctx.beginPath();
    ctx.moveTo(-0.036 * s, 0.975 * s);
    ctx.lineTo(0.05 * s, 0.98 * s);
    ctx.lineTo(0.05 * s, 1.0 * s);
    ctx.lineTo(-0.037 * s, 0.995 * s);
    ctx.closePath();
    ctx.fillStyle = spec.trim;
    ctx.fill();
  }
  // hand
  ctx.beginPath();
  ctx.ellipse(0.01 * s, 0.94 * s, 0.033 * s, 0.045 * s, 0.2, 0, Math.PI * 2);
  fillStroke(ctx, back ? darken(spec.skin, 0.86) : spec.skin);
  return { canvas: c, box, pivot: [0, sy] };
}

function drawHead(spec: FigureSpec, ppm: number, blink: boolean): Part {
  const { s, build } = proportions(spec);
  const cx = 0.012 * s;
  const cy = 1.6 * s;
  const R = 0.118 * s * (build === "child" ? 1.08 : 1);
  const box: [number, number, number, number] = [-0.19 * s, 1.24 * s, 0.2 * s, 1.8 * s];
  const { c, ctx } = canvasFor(box, ppm);
  const hair = spec.hair ?? "#2b1d14";
  const style = spec.hairStyle ?? "short";

  // long hair / head cloth hanging behind the head (drawn first)
  if (spec.headwrap) {
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.2, cy + R * 1.05);
    ctx.quadraticCurveTo(cx - R * 1.35, cy + R * 0.9, cx - R * 1.3, cy - R * 0.4);
    ctx.lineTo(cx - R * 1.25, cy - R * 2.1);
    ctx.quadraticCurveTo(cx - R * 0.6, cy - R * 2.25, cx - R * 0.15, cy - R * 1.9);
    ctx.lineTo(cx + R * 0.2, cy - R * 0.2);
    ctx.closePath();
    fillStroke(ctx, darken(spec.headwrap, 0.86));
  } else if (spec.scarf) {
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.1, cy + R * 1.12);
    ctx.quadraticCurveTo(cx - R * 1.4, cy + R * 1.0, cx - R * 1.25, cy - R * 0.6);
    ctx.lineTo(cx - R * 0.9, cy - R * 1.95);
    ctx.quadraticCurveTo(cx - R * 0.2, cy - R * 2.1, cx + R * 0.3, cy - R * 1.6);
    ctx.lineTo(cx + R * 0.4, cy - R * 0.4);
    ctx.closePath();
    fillStroke(ctx, darken(spec.scarf, 0.88));
  } else if (style === "long") {
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.3, cy + R * 1.0);
    ctx.quadraticCurveTo(cx - R * 1.3, cy + R * 0.8, cx - R * 1.2, cy - R * 0.5);
    ctx.quadraticCurveTo(cx - R * 1.2, cy - R * 1.9, cx - R * 0.5, cy - R * 2.0);
    ctx.lineTo(cx - R * 0.1, cy - R * 1.2);
    ctx.closePath();
    fillStroke(ctx, hair);
  }

  // ear-side neck shadow + face
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.95, cy + R * 0.25);
  ctx.quadraticCurveTo(cx - R * 1.0, cy + R * 1.08, cx + R * 0.05, cy + R * 1.06);
  ctx.quadraticCurveTo(cx + R * 0.82, cy + R * 1.0, cx + R * 0.95, cy + R * 0.3);
  ctx.quadraticCurveTo(cx + R * 1.0, cy + R * 0.05, cx + R * 1.12, cy - R * 0.12); // nose tip
  ctx.quadraticCurveTo(cx + R * 1.02, cy - R * 0.25, cx + R * 0.92, cy - R * 0.3);
  ctx.quadraticCurveTo(cx + R * 0.86, cy - R * 0.85, cx + R * 0.2, cy - R * 1.0); // chin
  ctx.quadraticCurveTo(cx - R * 0.7, cy - R * 1.0, cx - R * 0.95, cy + R * 0.25);
  ctx.closePath();
  fillStroke(ctx, spec.skin);

  // ear
  ctx.beginPath();
  ctx.ellipse(cx - R * 0.35, cy - R * 0.05, R * 0.13, R * 0.2, 0, 0, Math.PI * 2);
  fillStroke(ctx, darken(spec.skin, 0.9), LINE * 0.7);

  // hair on top
  if (!spec.headwrap && !spec.scarf && style !== "bald" && style !== "none") {
    ctx.beginPath();
    ctx.moveTo(cx - R * 1.0, cy + R * 0.05);
    ctx.quadraticCurveTo(cx - R * 1.12, cy + R * 1.2, cx + R * 0.1, cy + R * 1.16);
    ctx.quadraticCurveTo(cx + R * 0.95, cy + R * 1.05, cx + R * 0.88, cy + R * 0.45);
    ctx.quadraticCurveTo(cx + R * 0.4, cy + R * 0.7, cx - R * 0.15, cy + R * 0.42);
    ctx.quadraticCurveTo(cx - R * 0.3, cy + R * 0.1, cx - R * 0.55, cy - R * 0.35);
    ctx.closePath();
    fillStroke(ctx, hair);
    if (style === "curly") {
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(cx - R * 0.8 + i * R * 0.3, cy + R * (1.0 + (i % 2) * 0.08), R * 0.18, 0, Math.PI * 2);
        fillStroke(ctx, hair, LINE * 0.6);
      }
    }
  }
  if (spec.headwrap) {
    // cloth over the head, falling behind
    ctx.beginPath();
    ctx.moveTo(cx - R * 1.15, cy - R * 0.3);
    ctx.quadraticCurveTo(cx - R * 1.25, cy + R * 1.3, cx + R * 0.15, cy + R * 1.3);
    ctx.quadraticCurveTo(cx + R * 1.05, cy + R * 1.2, cx + R * 0.98, cy + R * 0.42);
    ctx.quadraticCurveTo(cx + R * 0.45, cy + R * 0.62, cx - R * 0.2, cy + R * 0.45);
    ctx.quadraticCurveTo(cx - R * 0.55, cy + R * 0.1, cx - R * 0.6, cy - R * 0.5);
    ctx.closePath();
    fillStroke(ctx, spec.headwrap);
    if (spec.headwrapBand) {
      ctx.beginPath();
      ctx.moveTo(cx - R * 1.08, cy + R * 0.62);
      ctx.quadraticCurveTo(cx - R * 0.1, cy + R * 0.92, cx + R * 0.93, cy + R * 0.62);
      ctx.lineWidth = R * 0.2;
      ctx.strokeStyle = spec.headwrapBand;
      ctx.stroke();
    }
  }
  if (spec.scarf) {
    ctx.beginPath();
    ctx.moveTo(cx - R * 1.05, cy - R * 0.6);
    ctx.quadraticCurveTo(cx - R * 1.25, cy + R * 1.35, cx + R * 0.2, cy + R * 1.32);
    ctx.quadraticCurveTo(cx + R * 1.0, cy + R * 1.2, cx + R * 0.82, cy + R * 0.4);
    ctx.quadraticCurveTo(cx + R * 0.3, cy + R * 0.75, cx - R * 0.35, cy + R * 0.3);
    ctx.quadraticCurveTo(cx - R * 0.55, cy - R * 0.2, cx - R * 0.45, cy - R * 0.9);
    ctx.closePath();
    fillStroke(ctx, spec.scarf);
  }

  // beard
  if (spec.beard && spec.beard !== "none") {
    const bc = spec.beardColor ?? hair;
    ctx.beginPath();
    if (spec.beard === "long") {
      ctx.moveTo(cx - R * 0.55, cy - R * 0.05);
      ctx.quadraticCurveTo(cx - R * 0.45, cy - R * 1.85, cx + R * 0.25, cy - R * 1.85);
      ctx.quadraticCurveTo(cx + R * 0.82, cy - R * 1.65, cx + R * 0.88, cy - R * 0.55);
      ctx.lineTo(cx + R * 0.95, cy - R * 0.32);
      ctx.quadraticCurveTo(cx + R * 0.55, cy - R * 0.42, cx + R * 0.28, cy - R * 0.28);
      ctx.quadraticCurveTo(cx - R * 0.1, cy - R * 0.32, cx - R * 0.3, cy + R * 0.02);
    } else {
      // short beard: a band along the jaw and chin, cheeks stay visible
      ctx.moveTo(cx - R * 0.42, cy - R * 0.12);
      ctx.quadraticCurveTo(cx - R * 0.35, cy - R * 1.12, cx + R * 0.28, cy - R * 1.12);
      ctx.quadraticCurveTo(cx + R * 0.82, cy - R * 1.02, cx + R * 0.86, cy - R * 0.5);
      ctx.lineTo(cx + R * 0.9, cy - R * 0.38);
      ctx.quadraticCurveTo(cx + R * 0.6, cy - R * 0.62, cx + R * 0.32, cy - R * 0.66);
      ctx.quadraticCurveTo(cx - R * 0.05, cy - R * 0.66, cx - R * 0.22, cy - R * 0.1);
    }
    ctx.closePath();
    fillStroke(ctx, bc);
    // moustache
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.95, cy - R * 0.34);
    ctx.quadraticCurveTo(cx + R * 0.6, cy - R * 0.22, cx + R * 0.38, cy - R * 0.38);
    ctx.lineWidth = R * 0.12;
    ctx.strokeStyle = bc;
    ctx.stroke();
  } else {
    // small mouth line
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.72, cy - R * 0.5);
    ctx.quadraticCurveTo(cx + R * 0.62, cy - R * 0.56, cx + R * 0.5, cy - R * 0.52);
    ctx.lineWidth = LINE * 0.7;
    ctx.strokeStyle = darken(spec.skin, 0.55);
    ctx.stroke();
  }

  // eye: almond, looking forward
  const ex = cx + R * 0.55;
  const ey = cy + R * 0.12;
  if (blink) {
    ctx.beginPath();
    ctx.moveTo(ex - R * 0.2, ey + R * 0.01);
    ctx.quadraticCurveTo(ex, ey - R * 0.09, ex + R * 0.2, ey + R * 0.02);
    ctx.lineWidth = LINE * 0.9;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(ex - R * 0.21, ey);
    ctx.quadraticCurveTo(ex, ey + R * 0.17, ex + R * 0.21, ey + R * 0.02);
    ctx.quadraticCurveTo(ex, ey - R * 0.12, ex - R * 0.21, ey);
    ctx.closePath();
    ctx.fillStyle = "#f4ede2";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(ex + R * 0.06, ey + R * 0.02, R * 0.085, R * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#2a1c12";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + R * 0.09, ey + R * 0.06, R * 0.025, 0, Math.PI * 2);
    ctx.fillStyle = "#fff8ee";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ex - R * 0.21, ey);
    ctx.quadraticCurveTo(ex, ey + R * 0.17, ex + R * 0.21, ey + R * 0.02);
    ctx.lineWidth = LINE * 0.8;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
  // brow
  ctx.beginPath();
  ctx.moveTo(ex - R * 0.25, ey + R * 0.27);
  ctx.quadraticCurveTo(ex, ey + R * 0.36, ex + R * 0.26, ey + R * 0.28);
  ctx.lineWidth = R * (spec.beard === "long" ? 0.11 : 0.075);
  ctx.strokeStyle = spec.brows ?? (spec.beardColor ?? hair);
  ctx.stroke();
  // cheek warmth
  ctx.beginPath();
  ctx.ellipse(cx + R * 0.45, cy - R * 0.22, R * 0.16, R * 0.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(200,90,70,0.16)";
  ctx.fill();
  if (spec.rim) {
    ctx.beginPath();
    ctx.arc(cx, cy + R * 0.1, R * 1.05, Math.PI * 0.55, Math.PI * 1.2);
    ctx.lineWidth = R * 0.12;
    ctx.strokeStyle = spec.rim;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  return { canvas: c, box, pivot: [0, 1.45 * s] };
}

function drawStaff(spec: FigureSpec, ppm: number): Part {
  const { s } = proportions(spec);
  const box: [number, number, number, number] = [-0.06, -0.05, 0.08, 1.95 * s];
  const { c, ctx } = canvasFor(box, ppm);
  ctx.beginPath();
  ctx.moveTo(-0.012, 0.0);
  ctx.lineTo(0.016, 0.0);
  ctx.lineTo(0.02, 1.8 * s);
  ctx.quadraticCurveTo(0.07, 1.86 * s, 0.03, 1.93 * s);
  ctx.quadraticCurveTo(-0.03, 1.95 * s, -0.035, 1.88 * s);
  ctx.lineTo(-0.012, 1.86 * s);
  ctx.quadraticCurveTo(0.0, 1.9 * s, 0.03, 1.86 * s);
  ctx.lineTo(-0.008, 1.8 * s);
  ctx.closePath();
  fillStroke(ctx, "#7a5536");
  return { canvas: c, box, pivot: [0, 0.94 * s] };
}

function drawWood(spec: FigureSpec, ppm: number): Part {
  const { s } = proportions(spec);
  // a bundle of sticks tied with rope, carried diagonally on the back
  const box: [number, number, number, number] = [-0.62 * s, 0.7 * s, 0.32 * s, 1.75 * s];
  const { c, ctx } = canvasFor(box, ppm);
  const logs = ["#8a5d3a", "#7a5032", "#956746", "#83583a", "#8f6240"];
  for (let i = 0; i < 5; i++) {
    const off = (i - 2) * 0.05 * s;
    ctx.save();
    ctx.translate(-0.16 * s, 1.24 * s + off);
    ctx.rotate(-0.62);
    ctx.beginPath();
    ctx.moveTo(-0.5 * s, -0.028 * s);
    ctx.lineTo(0.46 * s, -0.03 * s);
    ctx.lineTo(0.46 * s, 0.03 * s);
    ctx.lineTo(-0.5 * s, 0.028 * s);
    ctx.closePath();
    fillStroke(ctx, logs[i], LINE * 0.85);
    ctx.beginPath();
    ctx.ellipse(0.46 * s, 0, 0.016 * s, 0.029 * s, 0, 0, Math.PI * 2);
    fillStroke(ctx, "#d3ad82", LINE * 0.55);
    ctx.restore();
  }
  // rope bands and the shoulder strap
  for (const k of [-0.24, 0.18]) {
    ctx.save();
    ctx.translate(-0.16 * s, 1.24 * s);
    ctx.rotate(-0.62);
    ctx.beginPath();
    ctx.moveTo(k * s, -0.13 * s);
    ctx.lineTo(k * s + 0.025 * s, 0.13 * s);
    ctx.lineWidth = 0.024 * s;
    ctx.strokeStyle = "#d8c095";
    ctx.stroke();
    ctx.restore();
  }
  return { canvas: c, box, pivot: [0, 0.93 * s] };
}

function drawBeam(spec: FigureSpec, ppm: number): Part {
  const { s } = proportions(spec);
  // the wooden cross beam, resting across the back and shoulder
  const box: [number, number, number, number] = [-0.95 * s, 0.6 * s, 0.4 * s, 1.62 * s];
  const { c, ctx } = canvasFor(box, ppm);
  ctx.save();
  ctx.translate(-0.25 * s, 1.12 * s);
  ctx.rotate(-0.5);
  ctx.beginPath();
  ctx.moveTo(-0.72 * s, -0.045 * s);
  ctx.lineTo(0.66 * s, -0.045 * s);
  ctx.lineTo(0.66 * s, 0.045 * s);
  ctx.lineTo(-0.72 * s, 0.045 * s);
  ctx.closePath();
  fillStroke(ctx, "#7c5434");
  ctx.beginPath();
  ctx.moveTo(-0.7 * s, -0.012 * s);
  ctx.lineTo(0.64 * s, -0.008 * s);
  ctx.lineWidth = 0.008 * s;
  ctx.strokeStyle = "#5e3e26";
  ctx.stroke();
  ctx.restore();
  return { canvas: c, box, pivot: [0, 0.93 * s] };
}

export function drawFigure(spec: FigureSpec, ppm = 650): FigureParts {
  const { H, s } = proportions(spec);
  const parts: Partial<Record<PartName, Part>> = {
    legBack: drawLeg(spec, ppm, true),
    legFront: drawLeg(spec, ppm, false),
    body: drawBody(spec, ppm),
    armBack: drawArm(spec, ppm, true),
    armFront: drawArm(spec, ppm, false),
    head: drawHead(spec, ppm, false),
    headBlink: drawHead(spec, ppm, true),
  };
  if (spec.props?.staff) parts.staff = drawStaff(spec, ppm);
  if (spec.props?.wood) parts.wood = drawWood(spec, ppm);
  if (spec.props?.beam) parts.beam = drawBeam(spec, ppm);
  return {
    spec,
    height: H,
    parts,
    anchors: {
      head: [0.01 * s, 1.77 * s],
      hand: [0.01 * s, 0.94 * s],
      wood: [-0.2 * s, 1.36 * s],
      beam: [-0.45 * s, 1.35 * s],
      feet: [0, 0],
    },
  };
}
