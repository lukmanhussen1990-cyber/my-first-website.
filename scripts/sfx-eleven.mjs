// Optional: generate sound effects with the ElevenLabs Sound Effects API (cached in audio/sfx/eleven/).
// stems.py prefers these files; anything missing falls back to the numpy synth in scripts/sfx.py.
// Timing-critical sounds (stir cycle, clock ticks, cartoon gags) always stay synthesized so they sync.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ELEVEN, apiKey, P } from './config.mjs';

const SFX = {
  'laugh_0.wav': ['sitcom studio audience laughter burst, warm canned laughter heard from a TV', 3],
  'laugh_1.wav': ['big studio audience laugh, sitcom laugh track, heard from a living room TV', 3],
  'laugh_2.wav': ['short chuckling studio audience laughter, old TV sitcom', 3],
  'tv_cartoon.wav': ['playful cartoon music with xylophone, pizzicato bass and woodblock, heard from a TV in another room', 30, true],
  'hum.wav': ['a woman softly humming a gentle lullaby melody while cooking, mouth closed, intimate', 20],
  'sizzle.wav': ['frying pan sizzling on a stove, steady sizzle', 15, true],
  'fridge.wav': ['refrigerator low electrical hum in a quiet kitchen at night', 10, true],
  'drone.wav': ['low dark ambient horror drone, deep sub rumble, slowly evolving, unsettling', 30, true],
  'doorbell.wav': ['classic two tone ding dong doorbell inside a quiet house', 3],
  'bass_hit.wav': ['cinematic horror bass hit impact with deep sub boom and long tail', 3.5],
  'phone_buzz.wav': ['smartphone vibrating twice on a soft fabric sofa cushion', 1.5],
  'popcorn.wav': ['person crunching a mouthful of popcorn, close', 1.5],
  'riser.wav': ['short reverse cymbal swell riser into an impact', 1.2],
};

const key = apiKey();
if (!key) { console.log('  ElevenLabs SFX: no ELEVENLABS_API_KEY, using the synthesized effects'); process.exit(0); }
const dir = P('audio', 'sfx', 'eleven');
fs.mkdirSync(dir, { recursive: true });
for (const [name, [text, duration, loop]] of Object.entries(SFX)) {
  const wav = `${dir}/${name}`;
  if (fs.existsSync(wav)) { console.log(`  ${name}: cached`); continue; }
  const res = await fetch(`${ELEVEN.base}/v1/sound-generation?output_format=mp3_44100_192`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, duration_seconds: duration, prompt_influence: 0.45, ...(loop ? { loop: true } : {}) }),
  });
  if (!res.ok) { console.log(`  ${name}: ElevenLabs ${res.status} - falling back to synth`); continue; }
  const mp3 = `${dir}/${name.replace('.wav', '.mp3')}`;
  fs.writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp3, '-ac', '1', '-ar', '44100', wav]);
  console.log(`  ${name}: generated`);
}
