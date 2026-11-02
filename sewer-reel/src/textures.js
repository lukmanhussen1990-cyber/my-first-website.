// Procedural canvas textures (no external image assets).
import * as THREE from 'three';
import { rng } from './util.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]);
  t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
const shade = (hex, k) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return '#' + c.getHexString(); };

// Cobblestones: color map + bump map
export function cobble(seed = 1) {
  const R = rng(seed), S = 512;
  const [c, g] = canvas(S, S), [b, gb] = canvas(S, S);
  g.fillStyle = '#7d7466'; g.fillRect(0, 0, S, S); gb.fillStyle = '#000'; gb.fillRect(0, 0, S, S);
  const rows = 8, rh = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = (r % 2) * -32 - R() * 20;
    while (x < S) {
      const w = 52 + R() * 30, y = r * rh;
      const base = ['#b8ad99', '#a99f8c', '#c2b7a2', '#9d9483', '#b3a58e', '#c9bfae'][Math.floor(R() * 6)];
      for (const dx of [0, -S, S]) {
        const gr = g.createLinearGradient(x + dx, y, x + dx + w, y + rh);
        gr.addColorStop(0, shade(base, 0.07)); gr.addColorStop(1, shade(base, -0.06));
        g.fillStyle = gr; rr(g, x + dx + 3, y + 3, w - 6, rh - 6, 18); g.fill();
        const rg = gb.createRadialGradient(x + dx + w / 2, y + rh / 2, 2, x + dx + w / 2, y + rh / 2, w / 1.6);
        rg.addColorStop(0, '#fff'); rg.addColorStop(1, '#555');
        gb.fillStyle = rg; rr(gb, x + dx + 3, y + 3, w - 6, rh - 6, 18); gb.fill();
      }
      x += w;
    }
  }
  return { map: tex(c), bump: tex(b, [1, 1], false) };
}

export function bricks(seed = 2, base = '#b5653f') {
  const R = rng(seed), S = 512; const [c, g] = canvas(S, S); const [b, gb] = canvas(S, S);
  g.fillStyle = '#d9cbb3'; g.fillRect(0, 0, S, S); gb.fillStyle = '#000'; gb.fillRect(0, 0, S, S);
  const rows = 12, rh = S / rows, bw = S / 5;
  for (let r = 0; r < rows; r++) for (let i = -1; i < 6; i++) {
    const x = i * bw + (r % 2) * bw / 2, y = r * rh;
    g.fillStyle = shade(base, (R() - 0.5) * 0.12); rr(g, x + 3, y + 3, bw - 6, rh - 6, 6); g.fill();
    gb.fillStyle = '#ddd'; rr(gb, x + 3, y + 3, bw - 6, rh - 6, 6); gb.fill();
  }
  return { map: tex(c), bump: tex(b, [1, 1], false) };
}

export function soil(seed = 3) {
  const R = rng(seed), S = 512; const [c, g] = canvas(S, S);
  g.fillStyle = '#8a5a36'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = R() < 0.5 ? 'rgba(60,35,20,0.35)' : 'rgba(170,120,80,0.30)';
    g.beginPath(); g.arc(R() * S, R() * S, 2 + R() * 7, 0, 7); g.fill();
  }
  for (let i = 0; i < 40; i++) { // pebbles
    g.fillStyle = ['#9a8670', '#8a7562', '#a58f78'][i % 3];
    g.beginPath(); g.ellipse(R() * S, R() * S, 6 + R() * 10, 4 + R() * 7, R() * 3, 0, 7); g.fill();
  }
  return tex(c);
}

export function roofTiles(seed = 4, base = '#a86f4c') {
  const R = rng(seed), S = 512; const [c, g] = canvas(S, S); const [b, gb] = canvas(S, S);
  g.fillStyle = shade(base, -0.15); g.fillRect(0, 0, S, S); gb.fillStyle = '#000'; gb.fillRect(0, 0, S, S);
  const rows = 10, rh = S / rows, tw = S / 8;
  for (let r = 0; r < rows; r++) for (let i = -1; i < 9; i++) {
    const x = i * tw + (r % 2) * tw / 2, y = r * rh;
    const gr = g.createLinearGradient(0, y, 0, y + rh);
    const col = shade(base, (R() - 0.5) * 0.1);
    gr.addColorStop(0, shade(col, -0.08)); gr.addColorStop(1, shade(col, 0.06));
    g.fillStyle = gr; rr(g, x + 2, y, tw - 4, rh + 4, [0, 0, 14, 14]); g.fill();
    const gbr = gb.createLinearGradient(0, y, 0, y + rh); gbr.addColorStop(0, '#444'); gbr.addColorStop(1, '#fff');
    gb.fillStyle = gbr; rr(gb, x + 2, y, tw - 4, rh + 4, [0, 0, 14, 14]); gb.fill();
  }
  return { map: tex(c), bump: tex(b, [1, 1], false) };
}

export function plaster(seed = 5, base = '#f1e2c4') {
  const R = rng(seed), S = 256; const [c, g] = canvas(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(120,90,50,0.06)';
    g.beginPath(); g.arc(R() * S, R() * S, 1 + R() * 5, 0, 7); g.fill();
  }
  return tex(c);
}

export function planks(seed = 6, base = '#8a5a35') {
  const R = rng(seed), S = 256; const [c, g] = canvas(S, S);
  const n = 5, w = S / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = shade(base, (R() - 0.5) * 0.1); g.fillRect(i * w, 0, w, S);
    g.strokeStyle = 'rgba(40,20,10,0.25)'; g.lineWidth = 2;
    for (let k = 0; k < 4; k++) { g.beginPath(); const x = i * w + 6 + R() * (w - 12); g.moveTo(x, 0); g.bezierCurveTo(x + 6, S * 0.3, x - 6, S * 0.6, x + 3, S); g.stroke(); }
    g.fillStyle = 'rgba(30,15,5,0.6)'; g.fillRect(i * w, 0, 3, S);
  }
  return tex(c);
}

export function grass(seed = 7) {
  const R = rng(seed), S = 512; const [c, g] = canvas(S, S);
  g.fillStyle = '#4fa232'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = R() < 0.5 ? 'rgba(30,90,20,0.18)' : 'rgba(140,200,80,0.16)';
    g.beginPath(); g.arc(R() * S, R() * S, 2 + R() * 9, 0, 7); g.fill();
  }
  return tex(c);
}

// Scrolling liquid streaks (sewage / water)
export function ripples(seed = 8, base = '#7a5230', hi = 'rgba(255,230,190,0.35)') {
  const R = rng(seed), S = 256; const [c, g] = canvas(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  g.strokeStyle = hi; g.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const x = R() * S, y = R() * S, l = 20 + R() * 50;
    g.lineWidth = 2 + R() * 4;
    for (const dy of [0, -S, S]) { g.beginPath(); g.moveTo(x - l / 2, y + dy); g.quadraticCurveTo(x, y + dy - 6, x + l / 2, y + dy); g.stroke(); }
  }
  return tex(c);
}

// Cloth banner with the creator handle
export function banner(text) {
  const W = 1024, H = 300; const [c, g] = canvas(W, H);
  g.fillStyle = '#fff4d6'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#c8941e'; g.lineWidth = 18; rr(g, 16, 16, W - 32, H - 32, 26); g.stroke();
  g.strokeStyle = '#7a4a12'; g.lineWidth = 4; rr(g, 34, 34, W - 68, H - 68, 18); g.stroke();
  g.font = '700 112px Fredoka'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = '#5b3410'; g.strokeText(text, W / 2, H / 2 + 6);
  const gr = g.createLinearGradient(0, H / 2 - 50, 0, H / 2 + 50); gr.addColorStop(0, '#ffe45e'); gr.addColorStop(1, '#ffb11a');
  g.fillStyle = gr; g.fillText(text, W / 2, H / 2 + 6);
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

export function sign(text, bg = '#6b4423', fg = '#ffe9b0') {
  const W = 512, H = 160; const [c, g] = canvas(W, H);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.font = '700 84px Fredoka'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg; g.fillText(text, W / 2, H / 2 + 4);
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

export function newspaper() {
  const W = 256, H = 320; const [c, g] = canvas(W, H);
  g.fillStyle = '#f2eee2'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#333'; g.font = '700 34px Fredoka'; g.textAlign = 'center'; g.fillText('DAILY', W / 2, 44);
  for (let i = 0; i < 14; i++) { g.fillRect(20, 70 + i * 17, i % 4 === 3 ? 140 : 216, 7); }
  return tex(c);
}
