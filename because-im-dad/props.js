// props.js — reusable props drawn in local coordinates.
'use strict';

function star5(x, y, r, fill, sw = 0, rot = 0) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (-90 + i * 36 + rot) * DEG, rr = i % 2 ? r * 0.45 : r;
    d += (i ? 'L' : 'M') + n2(x + Math.cos(a) * rr) + ',' + n2(y + Math.sin(a) * rr);
  }
  return P(d + 'Z', fill, sw);
}
function maskDef(inner, box = 400) {
  const id = uid('mk');
  DEFS.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="${-box}" y="${-box}" width="${box * 2}" height="${box * 2}"><rect x="${-box}" y="${-box}" width="${box * 2}" height="${box * 2}" fill="#fff"/>${inner}</mask>`);
  return `mask="url(#${id})"`;
}

/* ---------- side-view work boot, toe to the right. origin = heel bottom. ~205 x 165 ---------- */
// o: kind 'old'|'new', flap 0..1, wet 0..1, tapeNew 0..1 (fresh strip being wrapped)
function bootSide(o = {}) {
  const neu = o.kind === 'new';
  const up = neu ? '#c98d50' : '#ad7845', upSh = neu ? '#a06936' : '#865931', upHi = neu ? '#eab878' : '#c69262';
  const sole = neu ? '#33241b' : '#4a3326';
  const flap = clamp(o.flap || 0), th = flap * 21 * DEG;
  let s = '';
  const hx = 104, hy = -8;
  const rot = (px, py) => [hx + (px - hx) * Math.cos(th) - (py - hy) * Math.sin(th), hy + (px - hx) * Math.sin(th) + (py - hy) * Math.cos(th)];
  if (flap > 0.01) {
    const a = rot(196, -16), b = rot(104, -16);
    s += P(`M104,-14 L192,-14 L${n2(a[0])},${n2(a[1])} L${n2(b[0])},${n2(b[1])} Z`, '#1f140e', 2.2);
    s += E(lerp(150, 168, flap), -12 + (a[1] + 14) * 0.45, 22 * flap + 4, 8 * flap + 2, (o.wet || 0) > 0.3 ? '#8f8c9a' : '#dcd6cc', 2);
  }
  s += P('M-4,-16 L106,-16 L106,0 L-2,0 Q-6,-2 -6,-8 Z', sole, 3);
  s += G(`rotate(${n2(flap * 21)} ${hx} ${hy})`, P('M102,-16 L188,-16 C204,-16 208,-4 198,0 L102,0 Z', sole, 3) + PS('M120,-4 l6,0 M136,-4 l6,0 M152,-4 l6,0 M168,-4 l6,0', '#2a1c14', 2));
  s += PS('M10,-4 l6,0 M28,-4 l6,0 M46,-4 l6,0 M64,-4 l6,0 M82,-4 l6,0', '#2a1c14', 2);
  const upper = 'M6,-150 C4,-120 2,-90 0,-60 C-2,-40 0,-20 4,-14 L186,-14 C198,-14 203,-24 201,-34 C199,-50 180,-60 150,-64 C120,-68 100,-74 88,-92 L84,-150 C60,-158 30,-158 6,-150 Z';
  s += P(upper, up, 3);
  s += P('M4,-14 C0,-20 -2,-40 0,-60 C14,-62 30,-58 40,-50 C44,-36 44,-24 40,-14 Z', upSh, 0, 'opacity="0.55"');
  s += P('M140,-14 L186,-14 C198,-14 202,-24 200,-34 C198,-50 178,-62 146,-64 C151,-46 149,-28 140,-14 Z', upSh, 0, 'opacity="0.5"');
  s += PS('M146,-64 C151,-46 149,-28 140,-14', OUT, 2.2);
  s += P('M6,-150 C30,-158 60,-158 84,-150 L84,-137 C60,-146 30,-146 6,-137 Z', '#6b4426', 2.4);
  s += P('M70,-158 C80,-168 94,-164 93,-150 L89,-98 L77,-102 Z', upHi, 2.4);
  for (let i = 0; i < 4; i++) s += C(86 + i * 1.2, -140 + i * 12, 3, '#d9c08a', 1.6);
  s += PS('M78,-146 L88,-134 M88,-146 L78,-134 M79,-134 L89,-122 M89,-134 L79,-122 M80,-122 L90,-110 M90,-122 L80,-110', '#f1e2bf', 2.4);
  s += PS('M8,-22 L184,-22', neu ? '#f0c58e' : '#d8b080', 1.6, 'stroke-dasharray="5 4"');
  if (!neu) {
    s += PS('M108,-62 q6,10 2,22 M118,-60 q5,8 1,18 M40,-118 l10,4 M30,-90 l12,-3 M170,-46 l8,2', '#7a4e2a', 2);
    s += P('M122,-66 L152,-63 L147,-14 L117,-14 Z', '#b3b8bf', 2.4) + PS('M126,-56 L148,-54 M124,-40 L146,-38 M122,-26 L144,-24', '#8b9199', 1.4);
    s += P('M152,-63 L164,-70 L160,-60 Z', '#c9cdd3', 2);
  } else {
    s += PS('M20,-128 C16,-100 14,-74 14,-50', '#ffe2b6', 4, 'opacity="0.75"');
    s += PS('M160,-56 C176,-52 190,-44 194,-34', '#ffe2b6', 4, 'opacity="0.75"');
    s += PS('M110,-60 C120,-62 130,-63 140,-63', '#ffe2b6', 3, 'opacity="0.6"');
  }
  if (o.tapeNew) {
    const k = clamp(o.tapeNew), y1 = -61 + 47 * k;
    const xl = lerp(156, 150, k), xr = lerp(186, 181, k);
    s += P(`M156,-61 L186,-50 L${n2(xr)},${n2(Math.max(y1, -50))} L${n2(xl)},${n2(y1)} Z`, '#c6cad0', 2.4) + PS('M160,-54 L182,-46', '#9aa0a8', 1.4);
  }
  if (o.wet) s += P('M110,-14 L196,-14 C202,-24 200,-34 196,-40 C170,-36 140,-30 110,-14 Z', '#1d3a63', 0, `opacity="${n2(0.4 * o.wet)}"`);
  return s;
}

/* ---------- kid sneaker side view, toe right, origin heel bottom, ~125 wide ---------- */
function sneakerSide(col = '#d8463c', accent = '#fff', light = false, t = 0) {
  let s = P('M2,-46 C0,-30 0,-18 4,-12 L108,-12 C122,-12 125,-22 116,-30 C104,-40 82,-44 66,-58 C58,-66 42,-67 31,-61 C21,-56 10,-56 2,-46 Z', col, 3);
  s += P('M96,-12 C112,-12 121,-19 116,-30 C110,-36 101,-38 93,-38 C97,-30 98,-21 96,-12 Z', accent, 2.2);
  s += P('M-2,-14 L112,-14 C127,-14 129,0 116,2 L0,2 Q-5,0 -2,-14 Z', '#fff', 3);
  s += PS('M40,-58 L60,-42 M50,-61 L68,-47 M58,-63 L74,-52', '#fff', 3);
  s += star5(30, -32, 9, accent, 1.6);
  if (light) s += R(10, -10, 94, 5, 2, `hsl(${n2((t * 360) % 360)},90%,65%)`, 0);
  s += PS('M10,-50 C8,-36 8,-26 10,-20', '#ffffff', 3, 'opacity="0.45"');
  return s;
}

function tapeRoll(x, y, s = 1, rot = 0) {
  return G(T(x, y, rot, s), P('M-26,0 a26,26 0 1,0 52,0 a26,26 0 1,0 -52,0 Z M-11,0 a11,11 0 1,1 22,0 a11,11 0 1,1 -22,0 Z', '#b9bec6', 3, 'fill-rule="evenodd"') + C(0, 0, 14.5, 'none', 0, 'stroke="#d8b98a" stroke-width="7"') + C(0, 0, 11, 'none', 2.2) + PS('M-18,-12 A21,21 0 0 1 10,-19', '#e3e6ea', 3));
}

/* ---------- lunch pail ---------- */
function lunchPail(o = {}) {
  const col = o.col || '#3d4f6b';
  let s = R(-64, -74, 128, 74, 9, col, 3) + R(-64, -20, 128, 8, 0, '#33435c', 0) + PS('M-58,-36 L58,-36', 'rgba(255,255,255,0.18)', 3);
  if (o.open) {
    s += P('M-60,-74 L60,-74 L56,-66 L-56,-66 Z', '#1d2738', 0);
  } else {
    s += P('M-64,-74 L-64,-90 Q-64,-128 0,-128 Q64,-128 64,-90 L64,-74 Z', col, 3) + PS('M-46,-108 Q-30,-122 0,-123', 'rgba(255,255,255,0.35)', 4);
    s += PS('M-26,-127 L-26,-142 Q0,-153 26,-142 L26,-127', OUT, 8) + PS('M-26,-127 L-26,-142 Q0,-153 26,-142 L26,-127', '#c9ced6', 4);
  }
  s += R(-9, -84, 18, 16, 3, '#c9ced6', 2.4);
  return s;
}
// open lunch pail from the owner's POV: lid stands at the far side, inner face visible
function lunchPailOpenPOV(o = {}) {
  let s = P('M-150,-120 L150,-120 L140,-300 Q0,-330 -140,-300 Z', '#c3c8cf', 3);
  s += P('M-132,-138 L132,-138 L124,-284 Q0,-308 -124,-284 Z', '#d6dadf', 0);
  s += G('translate(0,-212) rotate(-2)', kidsDrawing(176, 122, o.t || 0) + G('rotate(-30 -82 -63)', R(-102, -70, 40, 14, 2, '#e9e2c8', 1.5, 'opacity="0.9"')) + G('rotate(30 82 -63)', R(62, -70, 40, 14, 2, '#e9e2c8', 1.5, 'opacity="0.9"')));
  s += R(-160, -122, 320, 150, 14, '#3d4f6b', 3) + R(-146, -112, 292, 120, 10, '#1d2738', 2) + R(-146, -112, 292, 20, 6, '#26324a', 0);
  return s;
}

function bread(x, y, s = 1, rot = 0, bitten = false) {
  const crust = 'M-28,26 L-28,-6 C-38,-10 -38,-34 -18,-34 C-12,-46 12,-46 18,-34 C38,-34 38,-10 28,-6 L28,26 Q0,30 -28,26 Z';
  const inner = 'M-22,21 L-22,-8 C-30,-12 -30,-28 -15,-28 C-10,-38 10,-38 15,-28 C30,-28 30,-12 22,-8 L22,21 Q0,24 -22,21 Z';
  const m = bitten ? maskDef(C(30, -30, 13, '#000', 0) + C(18, -40, 11, '#000', 0) + C(36, -16, 10, '#000', 0), 80) : '';
  return G(T(x, y, rot, s), G('', P(crust, '#d79a52', 3) + P(inner, '#f7e6b8', 0) + C(-8, 2, 1.6, '#e2c88f', 0) + C(6, -10, 1.4, '#e2c88f', 0) + C(10, 8, 1.6, '#e2c88f', 0), m));
}

/* ---------- the kids' crayon drawing ---------- */
function kidsDrawing(w = 170, h = 118) {
  let s = R(-w / 2, -h / 2, w, h, 3, '#fffdf3', 2.2);
  const sc = w / 170;
  const cr = (d, c, wd = 3) => PS(d, c, wd, 'opacity="0.92"');
  let g = C(62, -40, 9, '#ffd23f', 0) + cr('M62,-54 L62,-50 M74,-40 L78,-40 M71,-49 L74,-52 M50,-49 L53,-52', '#ffb703', 2.4);
  g += C(-46, -14, 9, 'none', 0, 'stroke="#7a4a2a" stroke-width="2.6"') + P('M-56,-17 Q-46,-34 -36,-17 Z', '#ffc93c', 0) + cr('M-58,-17 L-34,-17', '#f2a10c', 2.6);
  g += cr('M-46,-5 L-46,22 M-46,4 L-60,12 M-46,4 L-30,10 M-46,22 L-54,38 M-46,22 L-38,38', '#c0392b', 3);
  g += C(-18, 4, 7, 'none', 0, 'stroke="#7a4a2a" stroke-width="2.4"') + cr('M-18,11 L-18,28 M-18,16 L-30,10 M-18,16 L-6,18 M-18,28 L-24,40 M-18,28 L-12,40', '#2f6fd0', 2.8);
  g += C(8, 8, 6.5, 'none', 0, 'stroke="#e0a21c" stroke-width="2.4"') + P('M8,15 L0,32 L16,32 Z', '#c77dff', 0, 'opacity="0.85"') + cr('M8,18 L-4,18 M8,18 L18,14 M4,32 L2,40 M12,32 L14,40', '#c77dff', 2.6);
  g += P('M34,2 C34,-6 44,-6 44,2 C44,-6 54,-6 54,2 C54,10 44,16 44,20 C44,16 34,10 34,2 Z', '#ff4d6d', 0);
  g += `<text x="-72" y="-36" font-family="${HAND}" font-size="22" fill="#2f6fd0">MY DAD</text>`;
  g += `<text x="10" y="46" font-family="${HAND}" font-size="17" fill="#e63946">IS MY HERO</text>`;
  return s + G(`scale(${n2(sc)})`, g);
}

function sledgehammer() { // hand-local: handle continues along the arm (+y)
  return R(-5, -16, 10, 112, 4, '#b07c4e', 2.6) + R(-28, 92, 56, 28, 5, '#5c6670', 3) + R(-28, 92, 56, 8, 3, '#7f8a95', 0) + PS('M-24,96 L24,96', 'rgba(255,255,255,0.4)', 2);
}

/* ---------- baseball ---------- */
function glove(x, y, s = 1, rot = 0) {
  const body = 'M-30,40 C-44,30 -47,0 -40,-20 L-38,-46 C-37,-57 -26,-57 -25,-46 L-24,-24 L-20,-58 C-19,-69 -7,-69 -6,-58 L-6,-28 L-2,-62 C-1,-73 11,-73 12,-62 L12,-28 L16,-56 C17,-66 28,-66 28,-55 L28,-20 C40,-31 55,-25 53,-12 C49,4 40,22 30,40 Q0,48 -30,40 Z';
  let g = P(body, '#b8692e', 3) + E(-2, 6, 22, 18, '#8f4a1d', 0) + PS('M-31,-40 L-31,-20 M-13,-52 L-13,-26 M5,-56 L5,-26 M22,-50 L22,-22', '#d98a4a', 2.4);
  g += PS('M28,-20 L40,-14 M30,-12 L44,-8 M30,-4 L46,-2', '#f1d29a', 2.4) + PS('M-34,-46 L-30,-50 M-16,-62 L-12,-66 M2,-66 L6,-70 M20,-60 L24,-64', '#f1d29a', 2.2);
  g += R(-30, 34, 60, 14, 6, '#8f4a1d', 3) + R(-8, 37, 16, 8, 2, '#f1d29a', 1.6);
  return G(T(x, y, rot, s), g);
}
function baseball(x, y, r = 10, rot = 0) {
  return G(T(x, y, rot, r / 10), C(0, 0, 10, '#fbfbf7', 2.2) + PS('M-6,-8 Q-2,0 -6,8 M6,-8 Q2,0 6,8', '#d33', 1.6));
}
function giftBag(x, y, s = 1, rot = 0, withGlove = true) {
  let g = '';
  if (withGlove) g += glove(6, -92, 0.42, 14);
  g += P('M-24,-70 L-16,-92 L-6,-75 L4,-96 L12,-75 L22,-89 L26,-70 Z', '#ffffff', 2.4);
  g += P('M-36,0 L-31,-72 L31,-72 L36,0 Z', '#2f5fb3', 3) + P('M-31,-72 L31,-72 L30,-60 L-30,-60 Z', '#244c93', 0);
  g += star5(-12, -34, 9, '#fff') + star5(14, -22, 7, '#fff') + star5(8, -50, 5, '#fff');
  g += PS('M-14,-72 Q-14,-94 0,-94 Q14,-94 14,-72', OUT, 4);
  return G(T(x, y, rot, s), g);
}

/* ---------- piggy bank (side, facing right). origin bottom center ---------- */
function piggyBank(x, y, s = 1, rot = 0) {
  let g = '';
  for (const lx of [-30, -12, 14, 30]) g += R(lx - 7, -18, 14, 18, 4, '#ef8fb0', 2.6);
  g += P('M-52,-46 c-12,-4 -12,-16 -4,-15 c6,1 2,9 -5,7', 'none', 0, 'stroke="#ef8fb0" stroke-width="4" stroke-linecap="round"');
  g += E(0, -46, 54, 38, '#f7a3c0', 3) + E(-10, -60, 30, 14, '#ffc2d6', 0, 'opacity="0.7"');
  g += P('M18,-78 L28,-98 L38,-76 Z', '#f7a3c0', 2.8) + P('M24,-80 L28,-90 L33,-79 Z', '#ef8fb0', 0);
  g += E(54, -48, 11, 14, '#ffbad0', 3) + E(51, -52, 2, 3, '#b25a7a', 0) + E(57, -44, 2, 3, '#b25a7a', 0);
  g += C(34, -60, 3.6, OUT, 0) + C(35.2, -61.4, 1.2, '#fff', 0);
  g += R(-14, -86, 28, 6, 3, '#b25a7a', 2.2);
  g += G('translate(-16,-44) rotate(-8)', R(-25, -12, 50, 26, 2, '#fff6a3', 2) + `<text x="0" y="1" text-anchor="middle" dominant-baseline="central" font-family="${HAND}" font-size="13" fill="#2f4b9b">GAME $</text>`);
  return G(T(x, y, rot, s), g);
}
function shard(x, y, s, rot, seed) {
  const r = rng(seed); const pts = [];
  const n = 4 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, rr = 8 + r() * 10; pts.push(`${n2(Math.cos(a) * rr)},${n2(Math.sin(a) * rr)}`); }
  return G(T(x, y, rot, s), `<polygon points="${pts.join(' ')}" fill="#f7a3c0" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>`);
}
function coin(x, y, r = 9, spin = 1, col = '#f5c542') {
  const ry = r, rx = Math.max(1.5, r * Math.abs(spin));
  return E(x, y, rx, ry, col, 2) + E(x, y, rx * 0.65, ry * 0.65, 'none', 0, 'stroke="#d9a21b" stroke-width="1.6"') + E(x - rx * 0.3, y - ry * 0.35, rx * 0.25, ry * 0.18, '#fff6c9', 0);
}
function bill(x, y, s = 1, rot = 0, val = '20') {
  return G(T(x, y, rot, s), R(-42, -19, 84, 38, 3, '#b6cfa3', 2.4) + R(-37, -14, 74, 28, 2, 'none', 0, 'stroke="#6f9a63" stroke-width="1.6"') + E(0, 0, 10, 12, '#9cc08d', 1.6) + C(0, -2, 4, '#6f9a63', 0) + TX(-27, -7, val, 10, '#4d7a44', { weight: 800 }) + TX(27, 7, val, 10, '#4d7a44', { weight: 800 }));
}

/* ---------- birthday ---------- */
function cake(x, y, s = 1, t = 0, lit = 1) {
  let g = E(0, 2, 100, 15, '#eef0f3', 3);
  g += R(-74, -62, 148, 62, 12, '#7a4a2e', 3) + R(-74, -34, 148, 8, 0, '#f6d7b0', 0);
  g += P('M-76,-64 Q0,-78 76,-64 L76,-50 Q68,-38 60,-50 Q52,-34 44,-50 Q34,-40 26,-50 Q16,-36 8,-50 Q-2,-40 -10,-50 Q-20,-34 -28,-50 Q-38,-40 -46,-50 Q-56,-36 -64,-50 Q-70,-42 -76,-50 Z', '#fff3e2', 3);
  const cols = ['#ff6b8b', '#4cc9f0', '#ffd166', '#90e0a0', '#c77dff'];
  for (let i = 0; i < 5; i++) {
    const cx = -44 + i * 22, top = -100;
    g += R(cx - 4, top, 8, 34, 2, cols[i], 2.2) + PS(`M${cx - 4},${top + 10} L${cx + 4},${top + 6} M${cx - 4},${top + 22} L${cx + 4},${top + 18}`, '#fff', 2);
    if (lit > 0) {
      const f = 1 + Math.sin(t * 19 + i * 2) * 0.12 + Math.sin(t * 31 + i) * 0.06;
      g += G(`translate(${cx},${top - 2}) scale(${n2(lit * 0.95)},${n2(lit * f)})`, P('M0,-20 C7,-11 7,-2 0,0 C-7,-2 -7,-11 0,-20 Z', '#ffb703', 2) + P('M0,-12 C3,-7 3,-2 0,-1 C-3,-2 -3,-7 0,-12 Z', '#fff4b8', 0));
    }
  }
  return G(T(x, y, 0, s), g);
}
function shoeBox(x, y, s = 1, lidOpen = 0) {
  let g = '';
  if (lidOpen > 0.15) {
    g += P('M-74,-64 L74,-64 L66,-80 L-66,-80 Z', '#f6efe2', 0);
    g += G('translate(-64,-50) scale(0.42)', bootSide({ kind: 'new' })) + G('translate(-10,-46) scale(0.42)', bootSide({ kind: 'new' }));
    g += P('M-78,-62 L-60,-72 L-40,-64 L-20,-74 L0,-64 L20,-74 L40,-64 L60,-72 L78,-62 L78,-56 L-78,-56 Z', '#fff', 2.2, 'opacity="0.95"');
  }
  g += R(-82, -62, 164, 62, 4, '#e07a36', 3) + R(-10, -62, 20, 62, 0, '#d33a3a', 2.4) + PS('M-62,-22 L-32,-22', '#c4662a', 3);
  const lid = R(-88, -76, 176, 18, 4, '#f08c45', 3) + R(-10, -76, 20, 18, 0, '#d33a3a', 2.4) + P('M0,-80 C-24,-104 -44,-88 -20,-78 Z', '#e04545', 2.6) + P('M0,-80 C24,-104 44,-88 20,-78 Z', '#e04545', 2.6) + C(0, -79, 6, '#c23434', 2.4);
  const arc = Math.sin(clamp(lidOpen) * Math.PI);
  g += G(`translate(${n2(lidOpen * 205)},${n2(-arc * 70 + lidOpen * 52)}) rotate(${n2(arc * 18 + lidOpen * 4)} 0 -67)`, lid);
  return G(T(x, y, 0, s), g);
}

/* ---------- construction + city ---------- */
function usFlag(x, y, s = 1, t = 0, w = 92, h = 56) {
  const N = 14, top = -h - 74;
  const wave = u => Math.sin(u * 3.4 - t * 6.5) * 6 * (0.25 + u);
  const px = u => 4 + u * w;
  let g = R(-3, top - 6, 6, -top + 6, 2, '#d6dade', 2.2) + C(0, top - 8, 5, '#f2c84b', 2);
  for (let i = 0; i < 13; i++) {
    const y0 = top + (i * h) / 13, y1 = top + ((i + 1) * h) / 13;
    let d = '';
    for (let k = 0; k <= N; k++) { const u = k / N; d += (k ? 'L' : 'M') + n2(px(u)) + ',' + n2(y0 + wave(u)); }
    for (let k = N; k >= 0; k--) { const u = k / N; d += 'L' + n2(px(u)) + ',' + n2(y1 + wave(u)); }
    g += `<path d="${d}Z" fill="${i % 2 ? '#ffffff' : '#d23b3e'}"/>`;
  }
  let cd = '';
  const cu = 0.42, ch = (h * 7) / 13;
  for (let k = 0; k <= 6; k++) { const u = (k / 6) * cu; cd += (k ? 'L' : 'M') + n2(px(u)) + ',' + n2(top + wave(u)); }
  for (let k = 6; k >= 0; k--) { const u = (k / 6) * cu; cd += 'L' + n2(px(u)) + ',' + n2(top + ch + wave(u)); }
  g += `<path d="${cd}Z" fill="#2c4a9a"/>`;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) { const u = ((c + 0.6) / 5.4) * cu; g += C(px(u), top + ((r + 0.7) / 4.4) * ch + wave(u), 1.5, '#fff', 0); }
  let od = '';
  for (let k = 0; k <= N; k++) { const u = k / N; od += (k ? 'L' : 'M') + n2(px(u)) + ',' + n2(top + wave(u)); }
  for (let k = N; k >= 0; k--) { const u = k / N; od += 'L' + n2(px(u)) + ',' + n2(top + h + wave(u)); }
  g += P(od + 'Z', 'none', 2.4);
  return G(T(x, y, 0, s), g);
}
function ibeamH(x, y, w, s = 1, col = '#c4553a') {
  let g = R(0, 0, w, 12, 2, '#de7556', 2.6) + R(0, 12, w, 34, 0, col, 2.6) + R(0, 12, w, 7, 0, '#93402c', 0) + R(0, 46, w, 12, 2, '#b34c34', 2.6);
  for (let i = 18; i < w; i += 36) g += C(i, 30, 3.4, '#9e452f', 1.6) + C(i - 1, 29, 1, '#e98f73', 0);
  return G(T(x, y, 0, s), g);
}
function ibeamV(x, y, h, s = 1, col = '#c4553a') {
  let g = R(-26, 0, 52, h, 2, col, 2.6) + R(-26, 0, 10, h, 0, '#de7556', 2.4) + R(16, 0, 10, h, 0, '#93402c', 2.4);
  for (let i = 20; i < h; i += 40) g += C(0, i, 3.4, '#9e452f', 1.6);
  return G(T(x, y, 0, s), g);
}
function crane(x, y, s = 1, col = '#e6b94a') {
  let lat = '';
  for (let yy = 0; yy > -380; yy -= 24) lat += `M-14,${yy} L14,${yy - 24} M14,${yy} L-14,${yy - 24} `;
  let g = `<path d="M-14,0 L-14,-400 M14,0 L14,-400 ${lat}" stroke="${col}" stroke-width="3" fill="none"/>`;
  let jl = '';
  for (let xx = -300; xx < 160; xx += 22) jl += `M${xx},-400 L${xx + 11},-418 L${xx + 22},-400 `;
  g += `<path d="M-300,-400 L160,-400 M-300,-418 L160,-418 ${jl}" stroke="${col}" stroke-width="3" fill="none"/>`;
  g += R(100, -420, 60, 30, 2, '#9aa3ad', 0) + R(-18, -440, 36, 30, 3, col, 0) + PS('M0,-440 L0,-470 M0,-470 L-300,-418 M0,-470 L160,-418', col, 2.4);
  g += PS('M-220,-400 L-220,-250', '#6b7480', 1.6) + R(-228, -252, 16, 14, 2, col, 0) + PS('M-220,-238 q-6,8 0,12', '#6b7480', 2.4);
  return G(T(x, y, 0, s), g);
}
function waterTower(x, y, s, col) {
  return G(T(x, y, 0, s), PS('M-14,0 L-10,-30 M14,0 L10,-30 M-12,-14 L12,-14', col, 2.4) + R(-16, -60, 32, 32, 3, col, 0) + P('M-18,-60 L0,-76 L18,-60 Z', col, 0));
}
function skyline(seed, x0, x1, base, hMin, hMax, col, winCol, o = {}) {
  const r = rng(seed); let s = '', x = x0;
  while (x < x1) {
    const w = 30 + r() * 60, h = hMin + r() * (hMax - hMin);
    s += R(x, base - h, w, h + 400, 0, col, 0);
    if (r() < 0.35) s += R(x + w * 0.3, base - h - 14, w * 0.4, 14, 0, col, 0);
    if (o.towers && r() < 0.3) s += waterTower(x + w * 0.5, base - h, 0.9, col);
    if (winCol) for (let wy = base - h + 10; wy < base - 6; wy += 14) for (let wx = x + 6; wx < x + w - 8; wx += 11) if (r() < (o.lit || 0.55)) s += `<rect x="${n2(wx)}" y="${n2(wy)}" width="5" height="7" fill="${winCol}"/>`;
    x += w + 2 + r() * 6;
  }
  return s;
}
function cloud(x, y, s = 1, col = '#fff', o = 1) {
  return op(o, G(T(x, y, 0, s), E(0, 0, 44, 18, col, 0) + E(-26, 4, 26, 13, col, 0) + E(28, 4, 28, 13, col, 0) + E(-6, -12, 26, 16, col, 0) + E(18, -8, 20, 13, col, 0)));
}
function streetlight(x, y, s = 1) {
  return G(T(x, y, 0, s), R(-5, -280, 10, 280, 3, '#3a3f4c', 2.4) + PS('M0,-276 Q0,-300 40,-300 L58,-300', '#3a3f4c', 7) + P('M44,-306 L84,-306 L78,-292 L50,-292 Z', '#4a5060', 2.4) + E(64, -291, 13, 4, '#fff1c4', 0));
}
function hydrant(x, y, s = 1) {
  return G(T(x, y, 0, s), R(-20, -10, 40, 10, 2, '#b8302f', 2.4) + R(-14, -52, 28, 44, 4, '#d23b3e', 2.6) + P('M-16,-52 Q0,-74 16,-52 Z', '#d23b3e', 2.6) + R(-24, -40, 48, 12, 4, '#b8302f', 2.4) + C(0, -36, 5, '#e6e6e6', 2));
}

/* ---------- test sheet for props (?test=props) ---------- */
function PROP_TEST(name, t) {
  let s = '';
  if (name === 'props') {
    s += G('translate(40,200) scale(0.8)', bootSide({ kind: 'old', flap: 0.8 })) + G('translate(230,200) scale(0.8)', bootSide({ kind: 'new' }));
    s += G('translate(420,190) scale(0.9)', sneakerSide('#d8463c')) + G('translate(560,190) scale(0.7)', sneakerSide('#ff8fb5', '#fff7fb', true, 0.3));
    s += G('translate(80,420) scale(0.6)', lunchPail()) + bread(190, 380, 1.2, 0, true) + glove(290, 380, 1, 0) + baseball(350, 420, 10) + giftBag(420, 440, 1);
    s += piggyBank(540, 440, 1) + cake(650, 440, 0.6, t);
    s += tapeRoll(380, 300, 1, 0) + bill(480, 300, 1, -8) + coin(560, 300, 10, 0.7);
    s += usFlag(640, 300, 0.9, t);
  } else if (name === 'props2') {
    s += '<rect width="720" height="480" fill="#a9d4f5"/>';
    s += crane(160, 470, 0.9) + skyline(5, 0, 720, 470, 60, 220, '#8fb0cf', '#cfe3f5', { towers: true });
    s += ibeamH(0, 330, 720) + ibeamV(560, 0, 330);
    s += G('translate(200,250) scale(0.9)', lunchPailOpenPOV({ t }));
    s += shoeBox(520, 300, 1, 1);
    s += G('translate(60,460) scale(0.9)', bootSide({ kind: 'old', tapeNew: 0.6 }));
  }
  return s;
}
