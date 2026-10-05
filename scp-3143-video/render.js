'use strict';
// SCP-3143 explainer renderer.
//
//   node render.js plan               timeline -> build/plan.json + build/subs.srt
//   node render.js still <sec> [png]  render one frame for preview
//   node render.js sheet [png] [step] contact sheet of frames every <step> s
//   node render.js video [workers]    render all frames -> build/video.mp4
//   node render.js mux [out.mp4]      combine video + build/mix.wav + subtitles
//
// Scene timing comes from the narration clips (build/voice.json) and word
// timestamps (build/words.json), so every animation is keyed to the voice.

const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { createCanvas } = require('@napi-rs/canvas');
const G = require('./gfx');
const SCENES = require('./scenes');

const { W, H } = G;
const FPS = 30, GAP = 0.22, TRANS = 0.6;
const ROOT = __dirname, BUILD = path.join(ROOT, 'build');
const readJSON = (p, dflt) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : dflt);

G.registerFonts();

// ------------------------------------------------------------- planning ----
const norm = s => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']/g, '');
function buildPlan() {
  const narr = readJSON(path.join(ROOT, 'narration.json'));
  const voice = readJSON(path.join(BUILD, 'voice.json'));
  const words = readJSON(path.join(BUILD, 'words.json'), {});
  const scenes = [];
  let start = 0;
  for (const sc of narr.scenes) {
    let local = sc.lead;
    const cues = [], durs = [], lines = [];
    sc.lines.forEach((ln, i) => {
      const key = `${sc.id}_${i}`;
      if (!voice[key]) throw new Error(`missing narration clip ${key}; run tts.py`);
      cues.push(local); durs.push(voice[key].duration);
      lines.push({ ...ln, key, file: voice[key].file, words: words[key] || [] });
      local += voice[key].duration + GAP + (ln.pause || 0);
    });
    if (sc.lines.length) local -= GAP;
    const S = { id: sc.id, start, dur: local + sc.tail, cues, durs, lines };
    // local time at which word `needle` (n-th occurrence) is spoken in line i
    S.at = (i, needle, occ = 0) => {
      const ln = lines[i], want = norm(needle);
      let k = 0;
      for (const w of ln.words) {
        const got = norm(w.w).replace(/^-/, '');
        if (got === want || got.replace(/'s$/, '') === want || (want.length > 3 && got.startsWith(want))) {
          if (k++ === occ) return cues[i] + w.s;
        }
      }
      const say = (ln.say || ln.text).toLowerCase(), idx = say.indexOf(needle.toLowerCase());
      if (!process.env.QUIET) console.warn(`  at(): "${needle}" not recognised in ${ln.key}; estimating`);
      return cues[i] + durs[i] * (idx < 0 ? 0 : idx / say.length);
    };
    S.inst = SCENES[sc.id](S);
    scenes.push(S);
    start += S.dur - TRANS;
  }
  const last = scenes[scenes.length - 1];
  const duration = last.start + last.dur;

  const narration = [], sfx = [], music = [], subs = [];
  for (const S of scenes) {
    S.lines.forEach((ln, i) => {
      narration.push({ t: +(S.start + S.cues[i]).toFixed(3), file: ln.file });
      subs.push({ a: S.start + S.cues[i], b: S.start + S.cues[i] + S.durs[i] + 0.25, text: ln.text });
    });
    const tr = S.inst.transIn;
    if (S.start > 0 && tr === 'blinds') sfx.push({ t: S.start, type: 'blinds' });
    if (S.start > 0 && tr === 'glitch') sfx.push({ t: S.start, type: 'glitch' });
    for (const e of S.inst.sfx || []) sfx.push({ ...e, t: +(S.start + e.t).toFixed(3) });
    for (const m of S.inst.music || []) music.push({ ...m, t: +(S.start + m.t).toFixed(3) });
  }
  sfx.sort((a, b) => a.t - b.t);
  music.sort((a, b) => a.t - b.t);
  return { scenes, duration, narration, sfx, music, subs };
}

function srtTime(s) {
  const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
}
function writePlan(plan) {
  fs.mkdirSync(BUILD, { recursive: true });
  const out = {
    fps: FPS, duration: plan.duration, narration: plan.narration, sfx: plan.sfx, music: plan.music,
    scenes: plan.scenes.map(s => ({ id: s.id, start: +s.start.toFixed(3), dur: +s.dur.toFixed(3) })),
  };
  fs.writeFileSync(path.join(BUILD, 'plan.json'), JSON.stringify(out, null, 1));
  const srt = plan.subs.map((s, i) => {
    const b = Math.min(s.b, i + 1 < plan.subs.length ? plan.subs[i + 1].a - 0.05 : s.b);
    return `${i + 1}\n${srtTime(s.a)} --> ${srtTime(b)}\n${s.text}\n`;
  }).join('\n');
  fs.writeFileSync(path.join(BUILD, 'subs.srt'), srt);
  fs.copyFileSync(path.join(BUILD, 'subs.srt'), path.join(ROOT, 'SCP-3143-explained.srt'));
  console.log(`plan: ${plan.scenes.length} scenes, ${plan.duration.toFixed(1)}s, ${plan.sfx.length} sfx`);
  for (const s of plan.scenes) console.log(`  ${s.id.padEnd(12)} ${s.start.toFixed(2).padStart(7)}  +${s.dur.toFixed(2)}`);
}

// ------------------------------------------------------------ rendering ----
function makeRenderer(plan) {
  const main = createCanvas(W, H), ctx = main.getContext('2d');
  const side = createCanvas(W, H), sctx = side.getContext('2d');
  const drawScene = (c, S, lt) => {
    c.save();
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    S.inst.draw(c, lt);
    c.restore();
  };
  return function frame(f) {
    const t = f / FPS;
    const act = plan.scenes.filter(s => t >= s.start && t < s.start + s.dur);
    if (act.length === 0) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return main; }
    const A = act[0];
    drawScene(ctx, A, t - A.start);
    if (act.length > 1) {
      const B = act[1], k = G.clamp((t - B.start) / TRANS);
      const kind = B.inst.transIn || 'fade';
      if (kind === 'cut') {
        if (k >= 0.5) drawScene(ctx, B, t - B.start);
      } else if (kind === 'fade') {
        if (k < 0.5) { ctx.fillStyle = `rgba(0,0,0,${k * 2})`; ctx.fillRect(0, 0, W, H); }
        else { drawScene(ctx, B, t - B.start); ctx.fillStyle = `rgba(0,0,0,${(1 - k) * 2})`; ctx.fillRect(0, 0, W, H); }
      } else if (kind === 'glitch') {
        if (k >= 0.5) drawScene(ctx, B, t - B.start);
        G.glitch(ctx, 1 - Math.abs(k - 0.5) * 2, f);
      } else { // venetian-blind wipe
        drawScene(sctx, B, t - B.start);
        const n = 12, sh = H / n;
        ctx.save(); ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const kk = G.E.inOutCubic(G.clamp(k * 1.5 - (i / n) * 0.5));
          if (kk > 0) ctx.rect(0, i * sh, W, sh * kk);
        }
        ctx.clip(); ctx.drawImage(side, 0, 0); ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        for (let i = 0; i < n; i++) {
          const kk = G.E.inOutCubic(G.clamp(k * 1.5 - (i / n) * 0.5));
          if (kk > 0 && kk < 1) ctx.fillRect(0, i * sh + sh * kk - 3, W, 6);
        }
      }
    }
    G.vignette(ctx, 0.9);
    G.flicker(ctx, f);
    G.grain(ctx, f, 0.05);
    return main;
  };
}

async function encode(plan, from, to, out) {
  const frame = makeRenderer(plan);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-tune', 'film', '-pix_fmt', 'yuv420p', '-threads', '2', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));
  for (let f = from; f < to; f++) {
    const c = frame(f);
    const buf = Buffer.from(c.data()); // copy: getImageData leaks native memory
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - from) % 300 === 0) process.stdout.write(`  [${path.basename(out)}] ${f - from}/${to - from}\n`);
    // frame buffers are native memory V8 doesn't see; collect regularly or workers balloon
    if (global.gc && (f - from) % 20 === 0) global.gc();
  }
  ff.stdin.end();
  await done;
}

async function main() {
  const [cmd = 'plan', ...args] = process.argv.slice(2);
  const plan = buildPlan();
  if (cmd === 'plan') { writePlan(plan); return; }
  if (cmd === 'still') {
    const t = parseFloat(args[0] || '5');
    const c = makeRenderer(plan)(Math.round(t * FPS));
    const out = args[1] || path.join(BUILD, `still_${t}.png`);
    fs.writeFileSync(out, c.toBuffer('image/png'));
    console.log(out);
    return;
  }
  if (cmd === 'sheet') {
    const out = args[0] || path.join(BUILD, 'sheet.png');
    const step = parseFloat(args[1] || '6'), from = parseFloat(args[2] || '0'), to = parseFloat(args[3] || plan.duration);
    const times = [];
    for (let t = from; t < to; t += step) times.push(t);
    const cols = 4, tw = 480, th = 270, rows = Math.ceil(times.length / cols);
    const sheet = createCanvas(cols * tw, rows * (th + 24)), sc = sheet.getContext('2d');
    sc.fillStyle = '#222'; sc.fillRect(0, 0, sheet.width, sheet.height);
    const frame = makeRenderer(plan);
    times.forEach((t, i) => {
      const c = frame(Math.round(t * FPS));
      const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + 24);
      sc.drawImage(c, x, y + 24, tw, th);
      sc.fillStyle = '#fff'; sc.font = '18px CourierP'; sc.fillText(`${t.toFixed(1)}s`, x + 6, y + 18);
    });
    fs.writeFileSync(out, sheet.toBuffer('image/png'));
    console.log(out);
    return;
  }
  if (cmd === 'segment') { // internal: worker process
    await encode(plan, parseInt(args[0], 10), parseInt(args[1], 10), args[2]);
    return;
  }
  if (cmd === 'video') {
    writePlan(plan);
    // Short segments in fresh processes keep memory bounded (canvas-to-canvas
    // draws in transitions/glitches still allocate native snapshots).
    const workers = parseInt(args[0] || '4', 10), nseg = workers * 4;
    const total = Math.ceil(plan.duration * FPS);
    const segs = [];
    for (let i = 0; i < nseg; i++) {
      const a = Math.floor((i * total) / nseg), b = Math.floor(((i + 1) * total) / nseg);
      segs.push({ a, b, out: path.join(BUILD, `seg${String(i).padStart(2, '0')}.mp4`) });
    }
    const t0 = Date.now();
    const run = s => new Promise((res, rej) => {
      const p = spawn(process.execPath, ['--expose-gc', __filename, 'segment', s.a, s.b, s.out], { stdio: 'inherit', env: { ...process.env, QUIET: '1' } });
      p.on('close', (c, sig) => (c === 0 ? res() : rej(new Error(`segment ${s.out} failed: code ${c} signal ${sig}`))));
    });
    const queue = segs.slice();
    await Promise.all(Array.from({ length: workers }, async () => { while (queue.length) await run(queue.shift()); }));
    fs.writeFileSync(path.join(BUILD, 'segs.txt'), segs.map(s => `file '${s.out}'`).join('\n'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(BUILD, 'segs.txt'), '-c', 'copy', path.join(BUILD, 'video.mp4')]);
    console.log(`video: ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    return;
  }
  if (cmd === 'mux') {
    const out = args[0] || path.join(ROOT, 'SCP-3143-explained.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(BUILD, 'video.mp4'), '-i', path.join(BUILD, 'mix.wav'), '-i', path.join(BUILD, 'subs.srt'),
      '-map', '0:v', '-map', '1:a', '-map', '2:s', '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-c:s', 'mov_text',
      '-metadata', 'title=SCP-3143 Explained: Murphy Law in... The Foundation Always Rings Twice!',
      '-metadata', 'comment=Based on SCP-3143 by The Great Hippo (scp-wiki.wikidot.com/scp-3143), CC BY-SA 3.0. This video is released under CC BY-SA 3.0.',
      '-metadata:s:s:0', 'language=eng', '-metadata:s:a:0', 'language=eng', '-t', plan.duration.toFixed(3), '-movflags', '+faststart', out]);
    console.log(out);
    return;
  }
  throw new Error('unknown command ' + cmd);
}

main().catch(e => { console.error(e); process.exit(1); });
