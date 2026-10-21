#!/usr/bin/env python3
"""Local fallback narrator (Piper TTS, offline) with exact word timings.

Writes, for every script line:
  voice/lines/line_XX.wav        48 kHz mono narration
  voice/timings/line_XX.json     word timings (seconds, relative to the start of the wav)

Word timings come straight from Piper's phoneme alignments, so subtitles are in perfect sync.
Usage:  python3 voice/make_voice_local.py [--voice build/piper/en_US-norman-medium.onnx]
"""
import argparse, json, os, subprocess, sys, tempfile
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PUNCT = set(',.!?;:')

STYLE = {  # Piper prosody per narration style
    'playful':    dict(length_scale=0.98, noise_scale=0.72, noise_w_scale=0.9, pause=0.22),
    'dramatic':   dict(length_scale=1.10, noise_scale=0.62, noise_w_scale=0.8, pause=0.34),
    'triumphant': dict(length_scale=1.06, noise_scale=0.66, noise_w_scale=0.85, pause=0.38),
}
# warm "trailer" polish: -1 semitone (formants kept), low-end weight, presence, compression, small room
FX = ("highpass=f=55,rubberband=pitch=0.9439:formant=preserved:pitchq=quality,"
      "equalizer=f=105:t=q:w=0.9:g=3.5,equalizer=f=320:t=q:w=1.2:g=-2,equalizer=f=3200:t=q:w=1.0:g=2.5,"
      "acompressor=threshold=-21dB:ratio=3.2:attack=4:release=140:makeup=3,"
      "aecho=0.85:0.6:38|71:0.10|0.06,aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=9")


def words_of(text):
    return text.split()


def synth_line(voice, text, style):
    from piper import SynthesisConfig
    st = STYLE.get(style, STYLE['playful'])
    cfg = SynthesisConfig(length_scale=st['length_scale'], noise_scale=st['noise_scale'], noise_w_scale=st['noise_w_scale'])
    sr = voice.config.sample_rate
    audio, words = [], []
    cursor = 0  # samples
    lead = int(0.06 * sr)
    audio.append(np.zeros(lead, np.float32)); cursor += lead
    for ci, chunk in enumerate(voice.synthesize(text, cfg, include_alignments=True)):
        if ci > 0:
            gap = int(st['pause'] * sr); audio.append(np.zeros(gap, np.float32)); cursor += gap
        al = chunk.phoneme_alignments or []
        pos = cursor
        cur = None
        for a in al:
            n = int(a.num_samples)
            ph = a.phoneme
            if ph in ('^', '$', ' ') or ph in PUNCT:
                if cur is not None:
                    words.append(cur); cur = None
            else:
                if cur is None:
                    cur = [pos, pos + n, 0]
                else:
                    cur[1] = pos + n
                if ph not in ('ˈ', 'ˌ', 'ː'):
                    cur[2] += 1
            pos += n
        if cur is not None:
            words.append(cur)
        a = chunk.audio_float_array.astype(np.float32)
        audio.append(a); cursor += len(a)
    audio.append(np.zeros(int(0.35 * sr), np.float32))
    return np.concatenate(audio), sr, [(s / sr, e / sr, k) for s, e, k in words]


def phone_count(voice, word):
    n = 0
    for sent in voice.phonemize(word):
        n += sum(1 for p in sent if p not in (' ', 'ˈ', 'ˌ', 'ː') and p not in PUNCT)
    return max(1, n)


def align_groups(groups, toks, voice):
    """Map phoneme word-groups (start, end, nphones) to script tokens. Handles merges/splits by DP."""
    wl = [phone_count(voice, w.strip(',.!?;:')) for w in toks]
    G, N = len(groups), len(toks)
    INF = 1e9
    dp = [[INF] * (N + 1) for _ in range(G + 1)]; bk = [[None] * (N + 1) for _ in range(G + 1)]
    dp[0][0] = 0
    for i in range(G + 1):
        for j in range(N + 1):
            if dp[i][j] >= INF: continue
            for gi, wj in ((1, 1), (1, 2), (1, 3), (2, 1)):
                if i + gi > G or j + wj > N: continue
                gl = sum(groups[i + k][2] for k in range(gi)); tl = sum(wl[j:j + wj])
                c = dp[i][j] + abs(gl - tl) / max(gl, tl) + 0.35 * (gi + wj - 2)
                if c < dp[i + gi][j + wj]: dp[i + gi][j + wj] = c; bk[i + gi][j + wj] = (gi, wj)
    out = [None] * N; i, j = G, N
    while i > 0 or j > 0:
        gi, wj = bk[i][j]
        g0, g1 = groups[i - gi][0], groups[i - 1][1]
        lens = wl[j - wj:j]; tot = sum(lens); acc = 0
        for k in range(wj):
            a = g0 + (g1 - g0) * acc / tot; acc += lens[k]; b = g0 + (g1 - g0) * acc / tot
            out[j - wj + k] = (a, b)
        i -= gi; j -= wj
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voice', default=os.path.join(ROOT, 'build/piper/en_US-norman-medium.onnx'))
    ap.add_argument('--out', default=HERE)
    args = ap.parse_args()
    from piper import PiperVoice
    voice = PiperVoice.load(args.voice, include_alignments=True)
    script = json.load(open(os.path.join(ROOT, 'script/voiceover.json')))
    os.makedirs(os.path.join(args.out, 'lines'), exist_ok=True)
    os.makedirs(os.path.join(args.out, 'timings'), exist_ok=True)
    for line in script['lines']:
        lid = line['id']; text = line['text']
        audio, sr, spans = synth_line(voice, text, line.get('style', 'playful'))
        toks = words_of(text)
        if len(spans) != len(toks):
            print(f'line {lid}: {len(spans)} phoneme groups vs {len(toks)} script words -> DP alignment', file=sys.stderr)
        spans = align_groups(spans, toks, voice)
        with tempfile.TemporaryDirectory() as td:
            raw = os.path.join(td, 'raw.wav')
            sf.write(raw, audio, sr, subtype='FLOAT')
            dst = os.path.join(args.out, 'lines', f'line_{lid:02d}.wav')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', FX, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s24le', dst], check=True)
        dur = sf.info(dst).duration
        data = {
            'id': lid, 'text': text, 'source': 'piper:' + os.path.basename(args.voice), 'duration': round(dur, 3),
            'words': [{'word': w, 'start': round(s, 3), 'end': round(e, 3)} for w, (s, e) in zip(toks, spans)],
        }
        json.dump(data, open(os.path.join(args.out, 'timings', f'line_{lid:02d}.json'), 'w'), indent=1)
        print(f'line {lid}: {dur:.2f}s, {len(toks)} words, speech {spans[0][0]:.2f}-{spans[-1][1]:.2f}s')


if __name__ == '__main__':
    main()
