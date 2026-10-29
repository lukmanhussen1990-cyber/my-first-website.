// Estimated timeline so the picture can be built before the real voice exists.
// Usage: node tools/fake_timeline.ts > audio/timeline.json
import {SENTENCES, sentenceWords} from '../src/script.ts';

const FPS = 30;
let t = 1 / FPS; // voice starts at frame 1
const words: any[] = [];
const sentences: any[] = [];
for (const s of SENTENCES) {
  const ws = sentenceWords(s);
  const start = t;
  ws.forEach((w, i) => {
    const letters = w.text.replace(/[^A-Za-z]/g, '').length;
    const dur = (0.1 + 0.052 * letters) * 0.95;
    words.push({text: w.text, start: +t.toFixed(3), end: +(t + dur).toFixed(3), sentence: s.id, scene: s.scene, page: w.page, keyword: w.keyword, tone: w.tone});
    t += dur;
    if (i < ws.length - 1) {
      if (/…$/.test(w.text)) t += 0.38;
      else if (/[.?!]["”]?$/.test(w.text)) t += 0.3;
      else if (/[;:]$/.test(w.text)) t += 0.22;
      else if (/,["”]?$/.test(w.text)) t += 0.15;
      else t += 0.04;
    }
  });
  sentences.push({id: s.id, scene: s.scene, start: +start.toFixed(3), end: +t.toFixed(3)});
  t += s.pauseAfter;
}
console.log(JSON.stringify({fps: FPS, voice: 'ESTIMATE (no audio yet)', voiceEnd: +t.toFixed(3), words, sentences}, null, 1));
