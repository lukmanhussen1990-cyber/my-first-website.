// World layout shared by geometry, shaders and animation.
// The Earth is one vertical column cut open along the plane z = 0. The near
// surface (backyard) is at y = 0; the far surface (beach) is at y = FAR_Y and
// is built upside-down (the far-side group is rotated 180 degrees about z).
export const LAYOUT = {
  TUNNEL_Z: -1.0,     // tunnel axis sits 1 m behind the cut face
  TUNNEL_R: 1.35,     // tunnel radius
  DRILL_R: 1.28, DRILL_LEN: 1.6,
  PIT_DEPTH: 5.0,
  CORE_Y: -72, CORE_R: 22,
  FAR_Y: -134,
  // depth bands (metres below each surface); deep layers bend round the core
  NEAR: { grass: 0.12, topsoil: 1.3, subsoil: 5.0, clay: 10.0, rock: 24.0, hot: 32.0, mantle: 50.0 },
  FAR: { sand: 6.0, rock: 17.0, hot: 23.0, mantle: 40.0 },
  // far-side bend toward the beach: starts BEND_START metres below the beach
  BEND_START: 16.0, BEND_LEN: 4.0, BEND_ANGLE: 0.26,
};

const SB = -LAYOUT.FAR_Y - LAYOUT.BEND_START; // depth where the bend begins
const { BEND_LEN: BL, BEND_ANGLE: BA } = LAYOUT;

// Path of the drilled tunnel as a function of world depth h = -y.
// Returns centre x, path length s and direction angle (0 = straight down,
// positive = leaning toward world +x).
export function pathAtDepth(h) {
  const d = Math.max(0, h - SB);
  const t = Math.min(d / BL, 1);
  const x = BA * BL * (t ** 3 - (t ** 4) / 2) + (d > BL ? Math.tan(BA) * (d - BL) : 0);
  const ang = BA * (3 * t * t - 2 * t ** 3);
  const s = Math.min(h, SB) + Math.min(d, BL) + 0.186 * BA * BA * BL * t ** 5 + (d > BL ? (d - BL) / Math.cos(BA) : 0);
  return { x, s, ang };
}
// Inverse: world position on the path after travelling s metres.
export function pathAtS(s) {
  if (s <= SB) return { x: 0, y: -s, ang: 0, h: s };
  let lo = SB, hi = SB + (s - SB) + 1;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (pathAtDepth(m).s < s) lo = m; else hi = m; }
  const h = (lo + hi) / 2, p = pathAtDepth(h);
  return { x: p.x, y: -h, ang: p.ang, h };
}

// GLSL twin of pathAtDepth + the "inside the drilled hole" test for the cut plane.
export const PATH_GLSL = /* glsl */`
uniform float uTipS;      // path length drilled so far (drill tip)
uniform float uDrillLen;  // cone length of the drill tip (0 = flat bottom)
uniform float uPitDepth;
uniform float uHole;      // 0..1 hole in the lawn open
vec3 pathAtDepth(float h){
  float SB = ${SB.toFixed(3)}, BL = ${BL.toFixed(3)}, BA = ${BA.toFixed(4)};
  float d = max(0.0, h - SB);
  float t = min(d / BL, 1.0);
  float x = BA * BL * (t*t*t - t*t*t*t * 0.5) + (d > BL ? tan(BA) * (d - BL) : 0.0);
  float ang = BA * (3.0*t*t - 2.0*t*t*t);
  float s = min(h, SB) + min(d, BL) + 0.186 * BA * BA * BL * t*t*t*t*t + (d > BL ? (d - BL) / cos(BA) : 0.0);
  return vec3(x, s, ang);
}
// > 0 inside the drilled opening on the cut plane, < 0 outside.
float holeInside(vec2 p, float halfW){
  if (p.y > 0.0) return -1.0;
  vec3 pa = pathAtDepth(-p.y);
  float dist = abs(p.x - pa.x) * cos(pa.z);
  float s = pa.y;
  float pit = (uHole > 0.5 && s <= uPitDepth) ? halfW - dist : -1.0;
  float w = halfW;
  if (s > uTipS) w = -1.0;
  else if (uDrillLen > 0.0 && s > uTipS - uDrillLen) w = halfW * (uTipS - s) / uDrillLen;
  return max(pit, w - dist);
}
`;
