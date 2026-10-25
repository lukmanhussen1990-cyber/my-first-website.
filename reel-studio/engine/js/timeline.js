// Scene system: scenes timed from voiceover clips, actors with local times,
// word cues, camera, shakes, transitions, sound cues and the frame renderer.
import { W, H, FPS, clamp, lerp, ease, prog, noise1, makeCanvas, COLORS } from './util.js';
import { paperBackground, xrayBackground, grainOverlay, drawPaperFurniture } from './draw.js';
import { FONTS } from './assets.js';

const normWord = (s) => (s || '')
  .normalize('NFC')
  .replace(/़/g, '')                 // nukta
  .replace(/ँ/g, 'ं')           // chandrabindu -> anusvara
  .replace(/[\s.,?!।…—"'’“”-]/g, '')
  .toLowerCase();

export class Actor {
  constructor(o = {}) {
    this.at = o.at ?? 0;
    this.until = o.until ?? Infinity;
    this.z = o.z ?? 0;
    this.layer = o.layer || 'world';
    this.o = o;
  }
  active(t) { return t >= this.at - 1e-6 && t < this.until; }
  draw(ctx, t, scene) {}
}

export class Custom extends Actor {
  constructor(o, fn) { super(o); this.fn = fn; }
  draw(ctx, t, scene) { this.fn(ctx, t, scene, this); }
}

export class Scene {
  constructor(reel, id, opts, vo) {
    this.reel = reel; this.id = id; this.opts = opts;
    this.look = opts.look || 'paper';
    this.fig = opts.fig ?? 1;
    this.vo = vo;
    this.voLead = opts.voLead ?? reel.cfg.voLead;
    this.voDur = vo ? vo.duration : (opts.voDur ?? 0);
    const tail = opts.tail ?? reel.cfg.tail;
    this.dur = Math.max(opts.minDur || 0, this.voLead + this.voDur + tail);
    this.actors = [];
    this.sounds = [];
    this.shakes = [];
    this.camKeys = null;
    this.cam = { push: opts.push ?? 0.035, fx: opts.fx ?? W / 2, fy: opts.fy ?? H * 0.55, driftX: opts.driftX ?? 10, driftY: opts.driftY ?? 6 };
    this.transition = opts.transition || { type: 'cut' };
    this.warnings = [];
  }

  // local time (s) of the n-th occurrence of a word in this scene's voiceover
  w(word, n = 0, edge = 's') {
    const words = this.vo ? this.vo.words : [];
    const target = normWord(word);
    let seen = 0;
    for (const wd of words) {
      const k = normWord(wd.w);
      if (k === target || (target.length > 2 && (k.startsWith(target) || target.startsWith(k) && k.length > 2))) {
        if (seen === n) return this.voLead + wd[edge];
        seen++;
      }
    }
    this.warnings.push(`${this.id}: word not found "${word}" (#${n})`);
    return this.voLead + (this.voDur * 0.5);
  }
  // word end
  we(word, n = 0) { return this.w(word, n, 'e'); }
  get end() { return this.dur; }
  get voEnd() { return this.voLead + this.voDur; }

  add(actor) { this.actors.push(actor); return actor; }
  custom(o, fn) { return this.add(new Custom(o, fn)); }
  sfx(t, name, gain = 1, opts = {}) { this.sounds.push({ t, name, gain, ...opts }); }
  shake(t, dur = 0.18, amp = 9) { this.shakes.push({ t, dur, amp }); }
  // camera keyframes: [[t, scale, fx, fy], ...] (fx, fy = screen point kept fixed)
  camera(keys) { this.camKeys = keys; }

  cameraAt(t) {
    let s, fx, fy;
    if (this.camKeys) {
      const k = this.camKeys;
      if (t <= k[0][0]) [, s, fx, fy] = k[0];
      else if (t >= k[k.length - 1][0]) [, s, fx, fy] = k[k.length - 1];
      else {
        for (let i = 0; i < k.length - 1; i++) {
          if (t >= k[i][0] && t <= k[i + 1][0]) {
            const e = k[i + 1][4] || ease.inOutCubic;
            const u = e((t - k[i][0]) / Math.max(1e-6, k[i + 1][0] - k[i][0]));
            s = lerp(k[i][1], k[i + 1][1], u); fx = lerp(k[i][2], k[i + 1][2], u); fy = lerp(k[i][3], k[i + 1][3], u);
            break;
          }
        }
      }
    } else {
      const u = clamp(t / Math.max(0.5, this.dur));
      s = 1 + this.cam.push * ease.outQuad(u);
      fx = this.cam.fx; fy = this.cam.fy;
    }
    const seed = this.fig * 7.31;
    let dx = noise1(t * 0.35, seed) * this.cam.driftX, dy = noise1(t * 0.3, seed + 3) * this.cam.driftY;
    for (const sh of this.shakes) {
      if (t >= sh.t && t < sh.t + sh.dur) {
        const k = 1 - (t - sh.t) / sh.dur;
        dx += Math.sin(t * 97) * sh.amp * k; dy += Math.cos(t * 83) * sh.amp * k;
      }
    }
    return { s, fx, fy, dx, dy };
  }

  toScreen(p) {
    const c = this.camNow;
    if (!c) return p;
    return [c.ax + c.dx + (p[0] - c.fx) * c.s, c.ay + c.dy + (p[1] - c.fy) * c.s];
  }

  shakeAt(t) {
    let dx = 0, dy = 0;
    for (const sh of this.shakes) {
      if (t >= sh.t && t < sh.t + sh.dur) {
        const k = 1 - (t - sh.t) / sh.dur;
        dx += Math.sin(t * 97) * sh.amp * k; dy += Math.cos(t * 83) * sh.amp * k;
      }
    }
    return { dx, dy };
  }
}

export class Reel {
  constructor(cfg, assets, voIndex) {
    this.cfg = Object.assign({ voLead: 0.08, tail: 0.3, endHold: 1.6, watermark: '@speciman.files', fileLabel: 'FILE No. 01' }, cfg);
    this.assets = assets;
    this.voIndex = voIndex || {};
    this.scenes = [];
    this.world = makeCanvas(W, H);
    this.wctx = this.world.getContext('2d');
    this.prevCanvas = makeCanvas(W, H);
    this.lastCut = null;
  }

  scene(id, opts, fn) {
    if (opts.skip) return null;
    const vo = this.voIndex[id] || null;
    const s = new Scene(this, id, opts, vo);
    s.build = fn;
    this.scenes.push(s);
    return s;
  }

  finalize() {
    let t = 0;
    for (const s of this.scenes) {
      s.start = t;
      if (s.build) s.build(s);
      s.actors.sort((a, b) => a.z - b.z);
      t += s.dur;
    }
    // final hold on the last scene
    if (this.scenes.length) this.scenes[this.scenes.length - 1].dur += this.cfg.endHold;
    this.duration = this.scenes.reduce((a, s) => a + s.dur, 0);
    this.frames = Math.ceil(this.duration * FPS);
  }

  timelineJSON() {
    const out = { fps: FPS, duration: this.duration, frames: this.frames, scenes: [], sounds: [], vo: [], warnings: [] };
    for (const s of this.scenes) {
      out.scenes.push({ id: s.id, start: s.start, dur: s.dur, look: s.look });
      if (s.vo) out.vo.push({ id: s.id, t: s.start + s.voLead, dur: s.voDur });
      for (const snd of s.sounds) out.sounds.push({ ...snd, t: s.start + snd.t, scene: s.id });
      out.warnings.push(...s.warnings);
    }
    out.sounds.sort((a, b) => a.t - b.t);
    return out;
  }

  sceneAt(t) {
    for (let i = 0; i < this.scenes.length; i++) {
      const s = this.scenes[i];
      if (t < s.start + s.dur || i === this.scenes.length - 1) return i;
    }
    return this.scenes.length - 1;
  }

  // draw one scene at local time t into ctx (full frame)
  drawScene(ctx, s, t) {
    ctx.save();
    ctx.drawImage(s.look === 'xray' ? xrayBackground() : paperBackground(), 0, 0);
    drawPaperFurniture(ctx, s.fig, { dark: s.look === 'xray', fileLabel: this.cfg.fileLabel });
    for (const a of s.actors) if (a.layer === 'bg' && a.active(t)) a.draw(ctx, t, s);

    // world layer (camera)
    const w = this.wctx;
    w.setTransform(1, 0, 0, 1, 0, 0);
    w.clearRect(0, 0, W, H);
    const cam = s.cameraAt(t);
    const k = clamp((cam.s - 1) / 0.25) * (s.opts.recenter ?? 1);
    cam.ax = cam.fx + (W / 2 - cam.fx) * k;
    cam.ay = cam.fy + (1060 - cam.fy) * k;
    w.translate(cam.ax + cam.dx, cam.ay + cam.dy); w.scale(cam.s, cam.s); w.translate(-cam.fx, -cam.fy);
    s.camNow = cam;
    for (const a of s.actors) if (a.layer === 'world' && a.active(t)) { w.save(); a.draw(w, t, s); w.restore(); }
    w.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.world, 0, 0);

    const sh = s.shakeAt(t);
    ctx.save(); ctx.translate(sh.dx * 0.6, sh.dy * 0.6);
    for (const a of s.actors) if (a.layer === 'ui' && a.active(t)) { ctx.save(); a.draw(ctx, t, s); ctx.restore(); }
    ctx.restore();
    for (const a of s.actors) if (a.layer === 'fx' && a.active(t)) { ctx.save(); a.draw(ctx, t, s); ctx.restore(); }

    // tie everything to the paper with a static grain
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = s.look === 'xray' ? 0.18 : 0.32;
    ctx.drawImage(grainOverlay(), 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.restore();
  }

  renderFrame(ctx, frame) {
    const t = frame / FPS;
    const i = this.sceneAt(t);
    const s = this.scenes[i];
    const lt = t - s.start;
    const tr = s.transition || { type: 'cut' };
    const td = tr.dur ?? 0.35;
    if (i > 0 && tr.type !== 'cut' && lt < td) {
      const prev = this.scenes[i - 1];
      const pctx = this.prevCanvas.getContext('2d');
      this.drawScene(pctx, prev, t - prev.start);
      this.drawScene(ctx, s, lt);
      transition(ctx, this.prevCanvas, tr.type, lt / td, s);
    } else {
      this.drawScene(ctx, s, lt);
    }
    this.drawWatermark(ctx);
  }

  drawWatermark(ctx) {
    ctx.save();
    ctx.font = `46px "${FONTS.gothic}"`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 0.7;
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#f5eedd';
    ctx.fillText(this.cfg.watermark, W / 2, Math.round(H * 0.78));
    ctx.restore();
  }
}

// prev = canvas of outgoing scene, ctx already holds incoming scene; p in 0..1
function transition(ctx, prev, type, p, s) {
  if (type === 'scan') {
    // incoming X-ray revealed top-down behind a bright scan line
    const y = ease.inOutQuad(p) * H;
    ctx.save(); ctx.beginPath(); ctx.rect(0, y, W, H - y); ctx.clip(); ctx.drawImage(prev, 0, 0); ctx.restore();
    const g = ctx.createLinearGradient(0, y - 60, 0, y + 14);
    g.addColorStop(0, 'rgba(255,240,215,0)'); g.addColorStop(0.8, 'rgba(255,240,215,0.45)'); g.addColorStop(1, 'rgba(255,250,240,0.95)');
    ctx.fillStyle = g; ctx.fillRect(0, y - 60, W, 74);
  } else if (type === 'curl') {
    // vertical paper roll sweeping right -> left, revealing the new page on the right
    const rollW = 150;
    const x = lerp(W + rollW, -rollW, ease.inOutCubic(p));
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, Math.max(0, x), H); ctx.clip(); ctx.drawImage(prev, 0, 0); ctx.restore();
    // shadow cast on the new page
    const sg = ctx.createLinearGradient(x + rollW * 0.5, 0, x + rollW * 0.5 + 110, 0);
    sg.addColorStop(0, 'rgba(40,25,10,0.42)'); sg.addColorStop(1, 'rgba(40,25,10,0)');
    ctx.fillStyle = sg; ctx.fillRect(x + rollW * 0.5, 0, 110, H);
    // the roll (cylinder shading)
    const rg = ctx.createLinearGradient(x - rollW * 0.5, 0, x + rollW * 0.5, 0);
    rg.addColorStop(0, '#a88f66'); rg.addColorStop(0.25, '#e9dbbd'); rg.addColorStop(0.55, '#f3e7cc');
    rg.addColorStop(0.85, '#c8b08a'); rg.addColorStop(1, '#8a7350');
    ctx.fillStyle = rg; ctx.fillRect(x - rollW * 0.5, 0, rollW, H);
  } else if (type === 'whip') {
    // fast push with motion-blur ghosts from the outgoing frame
    const k = 1 - p;
    ctx.save(); ctx.globalAlpha = 0.55 * k;
    for (let i = 1; i <= 4; i++) {
      const sc = 1 + 0.08 * i * (1 - k);
      ctx.drawImage(prev, W / 2 - (W * sc) / 2 + i * 22 * k, H / 2 - (H * sc) / 2, W * sc, H * sc);
    }
    ctx.restore();
  } else if (type === 'flash') {
    ctx.save(); ctx.globalAlpha = (1 - p) * 0.8; ctx.fillStyle = '#fff7e6'; ctx.fillRect(0, 0, W, H); ctx.restore();
  } else if (type === 'fade') {
    ctx.save(); ctx.globalAlpha = 1 - p; ctx.drawImage(prev, 0, 0); ctx.restore();
  }
}
