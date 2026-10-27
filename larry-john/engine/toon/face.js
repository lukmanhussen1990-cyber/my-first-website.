// Flat 2D "sticker" faces projected onto a 3D head.
// A face is drawn on a canvas in head-radius units (x right, y up, the head's front centre at 0,0)
// and projected along the head's local +Z axis in the shader, so it sticks to the head like a decal
// and can switch expression instantly. Every face is a pure function of a small "state" object.
import * as THREE from 'three';

const TAU = Math.PI * 2;

// ---- expression presets -------------------------------------------------------------------
export const EXPRESSIONS = {
  neutral:  { eyes: 'open', mouth: 'smile', brows: 'none', mouthOpen: 0.15 },
  happy:    { eyes: 'happy', mouth: 'grin', brows: 'up', mouthOpen: 0.8 },
  grin:     { eyes: 'open', mouth: 'grin', brows: 'up', mouthOpen: 0.7 },
  shocked:  { eyes: 'wide', mouth: 'O', brows: 'high', mouthOpen: 0.6, pupilScale: 0.55 },
  scared:   { eyes: 'wide', mouth: 'wavy', brows: 'worried', mouthOpen: 0.3, pupilScale: 0.45, sweat: 1 },
  screaming:{ eyes: 'squeeze', mouth: 'scream', brows: 'worried', mouthOpen: 1 },
  bored:    { eyes: 'bored', mouth: 'flat', brows: 'flat', mouthOpen: 0 },
  annoyed:  { eyes: 'annoyed', mouth: 'frown', brows: 'angry', mouthOpen: 0 },
  // extra expressions used in the reel
  smug:     { eyes: 'bored', mouth: 'smirk', brows: 'flat', mouthOpen: 0 },
  laugh:    { eyes: 'squeeze', mouth: 'grin', brows: 'up', mouthOpen: 1 },
  chew:     { eyes: 'happy', mouth: 'chew', brows: 'none', mouthOpen: 0.2 },
  dizzy:    { eyes: 'dizzy', mouth: 'wavy', brows: 'none', mouthOpen: 0.3 },
  yell:     { eyes: 'wide', mouth: 'scream', brows: 'angry', mouthOpen: 0.85, pupilScale: 0.6 },
  worried:  { eyes: 'open', mouth: 'wavy', brows: 'worried', mouthOpen: 0.2 },
  proud:    { eyes: 'happy', mouth: 'smile', brows: 'up', mouthOpen: 0.3 },
  flat:     { eyes: 'bored', mouth: 'flat', brows: 'none', mouthOpen: 0 },
  peek:     { eyes: 'open', mouth: 'smile', brows: 'none', mouthOpen: 0.1 },
  tongue:   { eyes: 'open', mouth: 'tongue', brows: 'none', mouthOpen: 0.6 },
  terrified:{ eyes: 'huge', mouth: 'scream', brows: 'worried', mouthOpen: 1, pupilScale: 0.35 },
  wink:     { eyes: 'wink', mouth: 'grin', brows: 'up', mouthOpen: 0.6 },
  sleepy:   { eyes: 'closed', mouth: 'smile', brows: 'none', mouthOpen: 0 },
};

// ---- per-character drawing style --------------------------------------------------------------
export const DEFAULT_STYLE = {
  eyeX: 0.36, eyeY: 0.12, eyeRX: 0.165, eyeRY: 0.2, pupilR: 0.085,
  mouthY: -0.40, mouthW: 0.30,
  outline: '#1c1714', sclera: '#ffffff', pupil: '#1a1412', lid: '#e8b897', mouthIn: '#7a1f2b', tongue: '#ef7d8c',
  teeth: '#fffaf2', blush: 'rgba(255,120,130,0.55)', blushX: 0.55, blushY: -0.18,
  freckles: null, freckleColor: '#c8703c', lineW: 0.034, gapTooth: false, fangs: false, lashes: false,
  browColor: '#4a2a18', browY: 0.42, eyeStyle: 'toon',
};

export class Face {
  constructor(style = {}, size = 1024) {
    this.style = { ...DEFAULT_STYLE, ...style };
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.key = '';
    this.state = { ...EXPRESSIONS.neutral };
    this.set('neutral');
  }

  // set(expressionName | stateObject, overrides)
  set(expr, extra = {}) {
    const base = typeof expr === 'string' ? (EXPRESSIONS[expr] || EXPRESSIONS.neutral) : expr;
    const st = { pupil: [0, 0], pupilScale: 1, lid: 0, mouthOpen: 0.3, blush: 1, sweat: 0, ...base, ...extra };
    const key = JSON.stringify(st);
    if (key === this.key) return;
    this.key = key; this.state = st;
    this.draw(st);
    this.texture.needsUpdate = true;
  }

  // ---- drawing ----
  draw(st) {
    const c = this.ctx, S = this.size, s = this.style;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, S, S);
    // face units: x,y in head radii; canvas covers [-1, 1]
    c.setTransform(S / 2, 0, 0, -S / 2, S / 2, S / 2);
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (st.blush && s.blush) this.drawBlush(st.blush);
    if (s.freckles) this.drawFreckles();
    if (s.eyeStyle === 'sheet') this.drawSheetEyes(st);
    else for (const side of [-1, 1]) this.drawEye(side, st);
    if (s.eyeStyle !== 'sheet') { if (!s.noBrows) this.drawBrows(st); this.drawMouth(st); }
    if (st.sweat) this.drawSweat(st.sweat);
    if (st.mark === 'anger') this.drawAnger();
  }

  ell(x, y, rx, ry, rot = 0) { const c = this.ctx; c.beginPath(); c.ellipse(x, y, Math.max(1e-4, rx), Math.max(1e-4, ry), rot, 0, TAU); }

  drawBlush(k) {
    const c = this.ctx, s = this.style;
    for (const side of [-1, 1]) {
      const x = side * s.blushX, y = s.blushY;
      const g = c.createRadialGradient(x, y, 0, x, y, 0.16);
      g.addColorStop(0, s.blush); g.addColorStop(0.6, s.blush.replace(/[\d.]+\)$/, (m) => (parseFloat(m) * 0.6 * k) + ')'));
      g.addColorStop(1, 'rgba(255,120,130,0)');
      c.fillStyle = g; c.save(); c.translate(x, y); c.scale(1.35, 0.8); c.translate(-x, -y);
      c.beginPath(); c.arc(x, y, 0.16, 0, TAU); c.fill(); c.restore();
    }
  }

  drawFreckles() {
    const c = this.ctx, s = this.style;
    c.fillStyle = s.freckleColor;
    for (const [x, y, r] of s.freckles) { c.beginPath(); c.arc(x, y, r || 0.016, 0, TAU); c.fill(); }
  }

  drawEye(side, st) {
    const c = this.ctx, s = this.style;
    const x = side * s.eyeX, y = s.eyeY;
    let rx = s.eyeRX, ry = s.eyeRY;
    const lw = s.lineW;
    c.lineWidth = lw; c.strokeStyle = s.outline;
    const mode = st.eyes;
    const px = (st.pupil?.[0] || 0) * rx * 0.45, py = (st.pupil?.[1] || 0) * ry * 0.45;
    if (s.eyeStyle === 'bean') return this.drawBeanEye(side, st);
    if (mode === 'happy' || mode === 'closed' || (mode === 'wink' && side < 0)) {
      c.beginPath();
      if (mode === 'closed') c.arc(x, y + ry * 0.2, rx * 0.85, Math.PI * 1.15, Math.PI * 1.85, false);
      else c.arc(x, y - ry * 0.35, rx * 0.85, Math.PI * 0.15, Math.PI * 0.85, false);
      c.lineWidth = lw * 1.25; c.stroke();
      if (s.lashes) this.drawLashes(x, y, rx);
      return;
    }
    if (mode === 'squeeze') {           // > <
      c.beginPath(); c.lineWidth = lw * 1.25;
      const d = side < 0 ? 1 : -1;
      c.moveTo(x - d * rx * 0.75, y + ry * 0.55); c.lineTo(x + d * rx * 0.55, y); c.lineTo(x - d * rx * 0.75, y - ry * 0.55);
      c.stroke(); return;
    }
    if (mode === 'dizzy') {            // spiral
      c.beginPath(); c.lineWidth = lw * 0.9;
      for (let a = 0; a < TAU * 2.4; a += 0.08) {
        const r = rx * 0.08 + a * rx * 0.055; const X = x + Math.cos(a * side) * r, Y = y + Math.sin(a * side) * r;
        a === 0 ? c.moveTo(X, Y) : c.lineTo(X, Y);
      }
      c.stroke(); return;
    }
    if (mode === 'wide' || mode === 'huge') { rx *= mode === 'huge' ? 1.32 : 1.14; ry *= mode === 'huge' ? 1.3 : 1.12; }
    // sclera
    this.ell(x, y, rx, ry); c.fillStyle = s.sclera; c.fill();
    // pupil + highlight (clipped to the eye)
    c.save(); this.ell(x, y, rx, ry); c.clip();
    const pr = s.pupilR * (st.pupilScale ?? 1) * (mode === 'bored' || mode === 'annoyed' ? 0.95 : 1);
    const pY = mode === 'bored' || mode === 'annoyed' ? y - ry * 0.18 + py : y + py;
    c.fillStyle = s.pupil; c.beginPath(); c.arc(x + px, pY, pr, 0, TAU); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x + px + pr * 0.38, pY + pr * 0.4, pr * 0.32, 0, TAU); c.fill();
    // lids: bored/annoyed have a heavy upper lid; blinking closes it
    let lid = st.lid || 0;
    let lidAngle = 0;
    if (mode === 'bored') lid = Math.max(lid, 0.5);
    if (mode === 'annoyed') { lid = Math.max(lid, 0.42); lidAngle = side * -0.32; }
    if (mode === 'wink' && side > 0) lid = Math.max(lid, 0);
    if (lid > 0.001) {
      const ly = y + ry - lid * 2 * ry;
      c.save(); c.translate(x, ly); c.rotate(lidAngle);
      c.fillStyle = s.lid; c.fillRect(-rx * 1.6, 0, rx * 3.2, ry * 3);
      c.beginPath(); c.moveTo(-rx * 1.6, 0); c.lineTo(rx * 1.6, 0); c.lineWidth = lw; c.stroke();
      c.restore();
    }
    c.restore();
    // outline
    this.ell(x, y, rx, ry); c.lineWidth = lw; c.stroke();
    if (s.lashes) this.drawLashes(x, y + ry * 0.55, rx);
  }

  drawLashes(x, y, rx) {
    const c = this.ctx;
    c.lineWidth = this.style.lineW * 0.8;
    const d = x > 0 ? 1 : -1;
    for (let k = 0; k < 2; k++) {
      c.beginPath(); c.moveTo(x + d * rx * (0.55 + k * 0.25), y + 0.05 - k * 0.04);
      c.lineTo(x + d * rx * (0.85 + k * 0.3), y + 0.12 - k * 0.06); c.stroke();
    }
  }

  // Big solid black oval eyes (the real ghost).
  drawBeanEye(side, st) {
    const c = this.ctx, s = this.style;
    const x = side * s.eyeX, y = s.eyeY;
    let rx = s.eyeRX, ry = s.eyeRY;
    const mode = st.eyes;
    if (mode === 'huge' || mode === 'wide') { rx *= mode === 'huge' ? 1.55 : 1.25; ry *= mode === 'huge' ? 1.5 : 1.22; }
    if (mode === 'happy' || mode === 'closed') {
      c.beginPath(); c.lineWidth = s.lineW * 1.6; c.strokeStyle = s.pupil;
      c.arc(x, y - ry * 0.3, rx * 0.8, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); return;
    }
    if (mode === 'squeeze') {
      c.beginPath(); c.lineWidth = s.lineW * 1.6; c.strokeStyle = s.pupil; const d = side < 0 ? 1 : -1;
      c.moveTo(x - d * rx * 0.7, y + ry * 0.5); c.lineTo(x + d * rx * 0.5, y); c.lineTo(x - d * rx * 0.7, y - ry * 0.5); c.stroke(); return;
    }
    c.save();
    this.ell(x, y, rx, ry); c.clip();
    c.fillStyle = s.pupil; c.fillRect(x - rx * 2, y - ry * 2, rx * 4, ry * 4);
    // shine
    const px = (st.pupil?.[0] || 0) * rx * 0.25, py = (st.pupil?.[1] || 0) * ry * 0.25;
    c.fillStyle = 'rgba(255,255,255,0.95)';
    this.ell(x + px + rx * 0.32, y + py + ry * 0.42, rx * 0.26, ry * 0.18, -0.4); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.6)';
    this.ell(x + px - rx * 0.25, y + py - ry * 0.45, rx * 0.11, ry * 0.08); c.fill();
    let lid = st.lid || 0;
    if (mode === 'bored') lid = Math.max(lid, 0.48);
    if (mode === 'annoyed') lid = Math.max(lid, 0.4);
    if (lid > 0.001) {
      const ly = y + ry - lid * 2 * ry;
      c.fillStyle = s.lid; c.save(); c.translate(x, ly); c.rotate(mode === 'annoyed' ? side * -0.3 : 0);
      c.fillRect(-rx * 2, 0, rx * 4, ry * 4); c.restore();
    }
    c.restore();
  }

  // Larry under the bedsheet: two uneven cut-out holes with his eyes peeking through.
  drawSheetEyes(st) {
    const c = this.ctx, s = this.style;
    const holes = s.holes || [
      { x: -0.33, y: 0.16, rx: 0.17, ry: 0.13, rot: 0.12, wob: 1 },
      { x: 0.35, y: 0.12, rx: 0.15, ry: 0.15, rot: -0.2, wob: 2 },
    ];
    const mode = st.eyes;
    holes.forEach((h, k) => {
      const side = k === 0 ? -1 : 1;
      // irregular scissor-cut hole
      const path = new Path2D();
      for (let i = 0; i <= 28; i++) {
        const a = (i / 28) * TAU;
        const wob = 1 + 0.08 * Math.sin(a * 3 + h.wob) + 0.05 * Math.sin(a * 7 + h.wob * 2);
        const X = h.x + Math.cos(a) * h.rx * wob, Y = h.y + Math.sin(a) * h.ry * wob;
        const rX = h.x + (X - h.x) * Math.cos(h.rot) - (Y - h.y) * Math.sin(h.rot);
        const rY = h.y + (X - h.x) * Math.sin(h.rot) + (Y - h.y) * Math.cos(h.rot);
        i === 0 ? path.moveTo(rX, rY) : path.lineTo(rX, rY);
      }
      path.closePath();
      c.fillStyle = '#231a20'; c.fill(path);
      c.save(); c.clip(path);
      // the eye inside the hole
      const ex = h.x + 0.01 * side, ey = h.y - 0.005;
      let rx = h.rx * 0.78, ry = h.ry * 0.95;
      if (mode === 'wide' || mode === 'huge') { rx *= 1.18; ry *= 1.25; }
      const px = (st.pupil?.[0] || 0) * rx * 0.4, py = (st.pupil?.[1] || 0) * ry * 0.4;
      c.lineWidth = s.lineW * 0.8; c.strokeStyle = '#1c1714';
      if (mode === 'happy' || mode === 'closed' || mode === 'squeeze') {
        c.beginPath();
        if (mode === 'squeeze') { const d = side < 0 ? 1 : -1; c.moveTo(ex - d * rx * 0.7, ey + ry * 0.5); c.lineTo(ex + d * rx * 0.5, ey); c.lineTo(ex - d * rx * 0.7, ey - ry * 0.5); }
        else c.arc(ex, ey - ry * 0.3, rx * 0.8, Math.PI * 0.15, Math.PI * 0.85);
        c.strokeStyle = '#f4f0ea'; c.lineWidth = s.lineW * 1.1; c.stroke();
      } else {
        this.ell(ex, ey, rx, ry); c.fillStyle = '#ffffff'; c.fill();
        const pr = s.pupilR * 0.82 * (st.pupilScale ?? 1);
        c.fillStyle = '#1a1412'; c.beginPath(); c.arc(ex + px, ey + py - (mode === 'bored' ? ry * 0.2 : 0), pr, 0, TAU); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + px + pr * 0.35, ey + py + pr * 0.35, pr * 0.3, 0, TAU); c.fill();
        let lid = st.lid || 0;
        if (mode === 'bored') lid = Math.max(lid, 0.5);
        if (mode === 'annoyed') lid = Math.max(lid, 0.42);
        if (lid > 0.001) {
          c.fillStyle = '#2d2228';
          c.save(); c.translate(ex, ey + ry - lid * 2 * ry); c.rotate(mode === 'annoyed' ? side * -0.3 : 0);
          c.fillRect(-rx * 2, 0, rx * 4, ry * 3); c.restore();
        }
      }
      c.restore();
      // cut edge: a thin light rim so the hole reads as cut cloth
      c.lineWidth = 0.012; c.strokeStyle = 'rgba(200,190,200,0.7)'; c.stroke(path);
    });
    // a scream pushes the sheet out at the mouth: soft round shading ring
    if (st.mouthPush > 0.01) {
      const k = st.mouthPush;
      const g = c.createRadialGradient(0, -0.42, 0.02, 0, -0.42, 0.25 * k + 0.05);
      g.addColorStop(0, 'rgba(60,40,60,' + 0.35 * k + ')'); g.addColorStop(0.7, 'rgba(90,80,110,' + 0.12 * k + ')'); g.addColorStop(1, 'rgba(90,80,110,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, -0.42, 0.3, 0, TAU); c.fill();
    }
  }

  drawBrows(st) {
    const c = this.ctx, s = this.style;
    const b = st.brows;
    if (!b || b === 'none') return;
    c.strokeStyle = s.browColor; c.lineWidth = s.lineW * 1.25;
    for (const side of [-1, 1]) {
      const x = side * s.eyeX, y = s.browY + (b === 'high' ? 0.08 : b === 'up' ? 0.03 : 0);
      let inner = 0, outer = 0, curve = 0.03;
      if (b === 'angry') { inner = -0.07; outer = 0.04; curve = 0; }
      if (b === 'worried') { inner = 0.06; outer = -0.04; curve = 0.01; }
      if (b === 'flat') { inner = -0.02; outer = 0.0; curve = 0; }
      const xi = x - side * 0.11, xo = x + side * 0.12;
      c.beginPath(); c.moveTo(xi, y + inner); c.quadraticCurveTo(x, y + curve + (inner + outer) / 2, xo, y + outer); c.stroke();
    }
  }

  drawMouth(st) {
    const c = this.ctx, s = this.style;
    const y = s.mouthY, w = s.mouthW, lw = s.lineW;
    const m = st.mouth, o = st.mouthOpen ?? 0.3;
    c.strokeStyle = s.outline; c.lineWidth = lw;
    const fillOpen = (pathFn) => {
      pathFn(); c.fillStyle = s.mouthIn; c.fill();
      c.save(); pathFn(); c.clip();
      // tongue
      c.fillStyle = s.tongue; this.ell(0, y - 0.22 * (0.4 + o) , w * 0.55, 0.14 * (0.5 + o)); c.fill();
      c.restore();
      pathFn(); c.lineWidth = lw; c.stroke();
    };
    if (m === 'smile') {
      c.beginPath(); c.arc(0, y + w * 0.9, w * 1.05, Math.PI * 1.32, Math.PI * 1.68); c.stroke();
    } else if (m === 'flat') {
      c.beginPath(); c.moveTo(-w * 0.55, y); c.lineTo(w * 0.55, y); c.stroke();
    } else if (m === 'frown') {
      c.beginPath(); c.arc(0, y - w * 1.05, w * 0.95, Math.PI * 0.36, Math.PI * 0.64); c.stroke();
    } else if (m === 'smirk') {
      c.beginPath(); c.moveTo(-w * 0.45, y + 0.01); c.quadraticCurveTo(w * 0.2, y - 0.03, w * 0.55, y + 0.07); c.stroke();
    } else if (m === 'wavy') {
      c.beginPath();
      for (let i = 0; i <= 24; i++) { const X = -w * 0.6 + (i / 24) * w * 1.2; const Y = y + Math.sin(i / 24 * Math.PI * 3) * 0.025; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }
      c.stroke();
    } else if (m === 'grin') {
      // D-shaped open smile with a row of top teeth (and Larry's gap tooth)
      const h = 0.14 + 0.16 * o;
      const path = () => { c.beginPath(); c.moveTo(-w * 1.0, y + 0.06); c.quadraticCurveTo(0, y + 0.1, w * 1.0, y + 0.06); c.bezierCurveTo(w * 0.9, y - h * 1.2, -w * 0.9, y - h * 1.2, -w * 1.0, y + 0.06); c.closePath(); };
      path(); c.fillStyle = s.mouthIn; c.fill();
      c.save(); path(); c.clip();
      c.fillStyle = s.tongue; this.ell(0, y - h * 0.95, w * 0.6, h * 0.45); c.fill();
      c.fillStyle = s.teeth;
      if (s.gapTooth) { c.fillRect(-w * 0.95, y - 0.02, w * 0.86, 0.12); c.fillRect(w * 0.09, y - 0.02, w * 0.86, 0.12); }
      else c.fillRect(-w, y - 0.015, w * 2, 0.11);
      if (s.fangs) { c.beginPath(); c.moveTo(-w * 0.5, y + 0.05); c.lineTo(-w * 0.38, y - 0.07); c.lineTo(-w * 0.26, y + 0.05); c.moveTo(w * 0.26, y + 0.05); c.lineTo(w * 0.38, y - 0.07); c.lineTo(w * 0.5, y + 0.05); c.fill(); }
      c.restore();
      path(); c.lineWidth = lw; c.stroke();
    } else if (m === 'O' || m === 'open') {
      const rx = w * (m === 'O' ? 0.38 : 0.3) * (0.7 + o * 0.5), ry = 0.05 + 0.13 * o;
      fillOpen(() => this.ell(0, y - ry * 0.3, rx, ry));
    } else if (m === 'scream') {
      const rx = w * (0.55 + 0.25 * o), ry = 0.12 + 0.17 * o;
      const path = () => { c.beginPath(); c.moveTo(-rx, y + 0.02); c.bezierCurveTo(-rx, y + ry * 0.6, rx, y + ry * 0.6, rx, y + 0.02); c.bezierCurveTo(rx * 0.95, y - ry * 1.8, -rx * 0.95, y - ry * 1.8, -rx, y + 0.02); c.closePath(); };
      path(); c.fillStyle = s.mouthIn; c.fill();
      c.save(); path(); c.clip();
      c.fillStyle = s.tongue; this.ell(0, y - ry * 1.3, rx * 0.62, ry * 0.5); c.fill();
      c.fillStyle = s.teeth; c.fillRect(-rx, y + ry * 0.12, rx * 2, 0.05);
      if (s.gapTooth) { c.fillStyle = s.mouthIn; c.fillRect(-0.012, y + ry * 0.12 - 0.01, 0.024, 0.07); }
      if (s.fangs) { c.fillStyle = s.teeth; c.beginPath(); c.moveTo(-rx * 0.6, y + ry * 0.15); c.lineTo(-rx * 0.48, y - 0.06); c.lineTo(-rx * 0.36, y + ry * 0.15); c.moveTo(rx * 0.36, y + ry * 0.15); c.lineTo(rx * 0.48, y - 0.06); c.lineTo(rx * 0.6, y + ry * 0.15); c.fill(); }
      c.restore();
      path(); c.lineWidth = lw; c.stroke();
    } else if (m === 'chew') {
      // closed, puffed cheeks: small wobbly line + crumbs
      c.beginPath(); c.moveTo(-w * 0.45, y); c.quadraticCurveTo(-w * 0.2, y - 0.04 - o * 0.05, 0, y); c.quadraticCurveTo(w * 0.2, y + 0.03, w * 0.45, y); c.stroke();
      c.fillStyle = '#e8b44a';
      for (const [cx, cy] of [[-w * 0.6, y - 0.08], [w * 0.5, y - 0.1], [w * 0.15, y - 0.13]]) { c.beginPath(); c.arc(cx, cy, 0.014, 0, TAU); c.fill(); }
    } else if (m === 'tongue') {
      c.beginPath(); c.arc(0, y + w * 0.9, w * 1.05, Math.PI * 1.32, Math.PI * 1.68); c.stroke();
      c.fillStyle = s.tongue; c.beginPath(); c.ellipse(w * 0.15, y - 0.07, 0.07, 0.09 * (0.6 + o), 0, 0, TAU); c.fill();
      c.lineWidth = lw * 0.8; c.stroke();
    } else if (m === 'teeth') {
      const path = () => { c.beginPath(); c.roundRect(-w * 0.75, y - 0.07, w * 1.5, 0.14, 0.05); };
      path(); c.fillStyle = s.teeth; c.fill();
      c.beginPath(); c.moveTo(-w * 0.75, y); c.lineTo(w * 0.75, y); c.lineWidth = lw * 0.6; c.stroke();
      path(); c.lineWidth = lw; c.stroke();
    }
  }

  drawSweat(k) {
    const c = this.ctx;
    const x = this.style.eyeX + 0.3, y = 0.42;
    c.fillStyle = 'rgba(140,200,255,0.95)'; c.strokeStyle = 'rgba(40,90,160,0.9)'; c.lineWidth = 0.015;
    c.beginPath(); c.moveTo(x, y + 0.13 * k); c.quadraticCurveTo(x + 0.07, y - 0.02, x, y - 0.05); c.quadraticCurveTo(x - 0.07, y - 0.02, x, y + 0.13 * k); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(x - 0.015, y - 0.005, 0.012, 0, TAU); c.fill();
  }

  drawAnger() {
    const c = this.ctx; c.strokeStyle = '#d92b2b'; c.lineWidth = 0.025;
    const x = -0.55, y = 0.6;
    for (const [a, b] of [[[-0.06, 0.02], [-0.02, 0.02]], [[0.02, 0.02], [0.06, 0.02]], [[-0.06, -0.02], [-0.02, -0.02]], [[0.02, -0.02], [0.06, -0.02]]]) {
      c.beginPath(); c.moveTo(x + a[0], y + a[1] * 3); c.quadraticCurveTo(x + (a[0] + b[0]) / 2, y, x + b[0], y + b[1] * 3); c.stroke();
    }
  }
}

// Patch a MeshStandardMaterial so it shows a Face texture, projected along local +Z.
//   extent: half-size of the face square in local units (usually the head radius)
//   glow:   how much the sticker colours glow on their own (keeps eyes readable at night)
//   ghost:  {rimColor, rimStrength, rimPower} adds a glowing fresnel rim, keeps the face opaque on a
//           see-through body and stops the body's glow from showing through the black eyes.
export function applyFace(material, face, { extent = 1, center = [0, 0], glow = 0.0, depth = 0.25, ghost = null } = {}) {
  material.userData.faceUniforms = {
    faceMap: { value: face.texture },
    faceExtent: { value: extent },
    faceCenter: { value: new THREE.Vector2(...center) },
    faceGlow: { value: glow },
    faceDepth: { value: depth },
    rimColor: { value: new THREE.Color(ghost?.rimColor || '#ffffff') },
    rimStrength: { value: ghost?.rimStrength ?? 0 },
    rimPower: { value: ghost?.rimPower ?? 2.0 },
  };
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, material.userData.faceUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFaceP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFaceP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vFaceP;
        uniform sampler2D faceMap; uniform float faceExtent; uniform vec2 faceCenter; uniform float faceGlow; uniform float faceDepth;
        uniform vec3 rimColor; uniform float rimStrength; uniform float rimPower;
        vec4 gFace;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 fuv = (vFaceP.xy - faceCenter) / (2.0 * faceExtent) + 0.5;
          float front = smoothstep(0.0, faceDepth, vFaceP.z / faceExtent);
          gFace = texture2D(faceMap, fuv);
          float inside = step(0.0, fuv.x) * step(fuv.x, 1.0) * step(0.0, fuv.y) * step(fuv.y, 1.0);
          gFace.a *= front * inside;
          diffuseColor.rgb = mix(diffuseColor.rgb, gFace.rgb, gFace.a);
          ${ghost ? 'diffuseColor.a = max(diffuseColor.a, gFace.a);' : ''}
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        ${ghost ? `
        float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normalize(vNormal))), rimPower);
        totalEmissiveRadiance += rimColor * fres * rimStrength;
        diffuseColor.a = max(diffuseColor.a, min(1.0, diffuseColor.a + fres * 0.45));
        totalEmissiveRadiance *= (1.0 - gFace.a * (1.0 - dot(gFace.rgb, vec3(0.33))));` : ''}
        totalEmissiveRadiance += gFace.rgb * gFace.a * faceGlow;`);
  };
  material.customProgramCacheKey = () => (ghost ? 'faceGhost' : 'face');
  material.needsUpdate = true;
  return material;
}
