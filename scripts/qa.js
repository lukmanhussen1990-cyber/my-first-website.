// QA for the final MP4: format check, loudness, and a frame every 3 s with
// what the timeline says should be on screen / being said at that moment.
//
//   node scripts/qa.js [final/train_berth.mp4]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, loadTimeline } from './lib.js';

const file = path.resolve(ROOT, process.argv[2] || 'final/train_berth.mp4');
const tl = loadTimeline();
const outDir = path.join(ROOT, 'frames/qa');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const probe = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }).stdout);
const v = probe.streams.find((s) => s.codec_type === 'video');
const a = probe.streams.find((s) => s.codec_type === 'audio');
const dur = Number(probe.format.duration);
const ebu = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const lufs = ebu.match(/I:\s+(-?[\d.]+) LUFS/g)?.pop();
const tp = ebu.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.pop();
// walk the top-level atoms: +faststart means moov comes before mdat
const faststart = (() => {
  const buf = fs.readFileSync(file);
  const order = [];
  for (let pos = 0; pos + 8 <= buf.length; ) {
    let size = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    if (size === 1) size = Number(buf.readBigUInt64BE(pos + 8));
    if (size === 0) size = buf.length - pos;
    order.push(type);
    pos += size;
  }
  return order.indexOf('moov') >= 0 && order.indexOf('moov') < order.indexOf('mdat');
})();
const checks = [
  ['resolution 1080x1920', v.width === 1080 && v.height === 1920, `${v.width}x${v.height}`],
  ['30 fps', v.r_frame_rate === '30/1', v.r_frame_rate],
  ['H.264 yuv420p', v.codec_name === 'h264' && v.pix_fmt === 'yuv420p', `${v.codec_name} ${v.pix_fmt}`],
  ['AAC ~192k', a?.codec_name === 'aac' && Math.abs(Number(a.bit_rate) - 192000) < 20000, `${a?.codec_name} ${a?.bit_rate}`],
  ['length 55-65 s', dur >= 55 && dur <= 65, `${dur.toFixed(2)} s`],
  ['loudness about -14 LUFS', Math.abs(parseFloat(lufs?.split(':')[1]) + 14) < 1, `${lufs} / true ${tp}`],
  ['+faststart (moov first)', faststart, String(faststart)],
];
const lines = ['# QA report', '', `file: ${path.relative(ROOT, file)} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB)`, ''];
for (const [name, ok, val] of checks) lines.push(`- [${ok ? 'x' : ' '}] ${name}: ${val}`);
lines.push('', '| t | scene | on screen (timeline) | being said |', '|---|---|---|---|');

const sceneAt = (t) => tl.scenes.find((s) => t >= s.start && t < s.end) || tl.scenes[tl.scenes.length - 1];
for (let t = 0; t <= dur - 0.05; t += 3) {
  const f = path.join(outDir, `qa_${String(Math.round(t)).padStart(2, '0')}s.png`);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', t.toFixed(3), '-i', file, '-frames:v', '1', f]);
  const sc = sceneAt(t);
  const onScreen = [];
  if (sc.caption && t >= sc.caption.start) onScreen.push(`caption "${sc.caption.text}"`);
  if (sc.id === 's02') onScreen.push('alert card');
  if (sc.notification && t >= sc.notification.start) onScreen.push(`alert "${sc.notification.text}"`);
  if (sc.bubble) onScreen.push(`bubble "${sc.bubble.text}"`);
  if (sc.choice || sc.choice_hold) onScreen.push('choice card');
  if (sc.twist) onScreen.push('twist: feet turning');
  const said = sc.vo ? sc.vo.words.filter((w) => w.start <= t + 0.6 && w.end >= t - 0.6).map((w) => w.text).join(' ') : '';
  lines.push(`| ${t.toFixed(0)}s | ${sc.id} | ${onScreen.join(', ') || '-'} | ${said || '-'} |`);
}
spawnSync('ffmpeg', ['-v', 'error', '-y', '-pattern_type', 'glob', '-i', path.join(outDir, 'qa_*.png'), '-vf', 'scale=270:480,tile=7x3:padding=4:color=white', '-frames:v', '1', path.join(outDir, 'contact_sheet.png')]);
fs.writeFileSync(path.join(outDir, 'report.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
