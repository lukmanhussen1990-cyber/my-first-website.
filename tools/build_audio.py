#!/usr/bin/env python3
"""Build the audio stems and mixes from src/timeline.json.

  voice : every voice line placed at its timeline start          -> final/stems/voice.wav
  music : theme bed, crossfade-looped if too short, faded to total
          silence right before the final crack (scene 11)          -> final/stems/music.wav
  sfx   : made by tools/sfx.py                                    -> final/stems/sfx.wav (optional here)
  mixes : music + sfx ducked under the voice (sidechaincompress),
          loudness-normalised to -16 LUFS, true peak -1.5 dBTP     -> audio/mix.wav, audio/mix_nomusic.wav

  python3 tools/build_audio.py [--preview]   (--preview: voice + music only, single-pass loudnorm)
"""
import json, os, subprocess, sys
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
TL = json.load(open(os.path.join(ROOT, 'src', 'timeline.json')))
STEMS = os.path.join(ROOT, 'final', 'stems')
os.makedirs(STEMS, exist_ok=True)
DUR = TL['duration']
N = int(round(DUR * SR))


def decode(path, channels=2):
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', str(channels), '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(pcm, dtype=np.float32).copy()
    return x.reshape(-1, channels)


def lufs(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
    for line in reversed(r.stderr.splitlines()):
        if line.strip().startswith('I:'):
            return float(line.split()[1])
    return None


def write(path, x):
    sf.write(path, np.clip(x, -1, 1).astype(np.float32), SR, subtype='FLOAT')


def build_voice():
    out = np.zeros((N, 2), dtype=np.float64)
    for sc in TL['scenes']:
        for ln in sc['lines']:
            if not ln.get('audio'):
                continue
            x = decode(os.path.join(ROOT, ln['audio']), 1)[:, 0]
            i0 = int(round(ln['start'] * SR))
            i1 = min(N, i0 + len(x))
            out[i0:i1, 0] += x[:i1 - i0]
            out[i0:i1, 1] += x[:i1 - i0]
    path = os.path.join(STEMS, 'voice.wav')
    write(path, out)
    # level the voice stem to about -19 LUFS before mixing
    g = 10 ** ((-19.0 - lufs(path)) / 20)
    write(path, out * g)
    print(f'voice stem: {lufs(path):.1f} LUFS')
    return path


def build_music():
    src = os.path.join(ROOT, 'audio', 'music', 'derry_theme.mp3')
    x = decode(src, 2)
    # trim trailing silence (content end = last sample above -45 dBFS)
    env = np.abs(x).max(axis=1)
    loud = np.where(env > 10 ** (-45 / 20))[0]
    x = x[: loud[-1] + 1]
    s11 = TL['scenes'][-1]
    end = s11['start'] + 0.4                 # total silence starts here (1 s before the crack)
    need = int(round(end * SR))
    xf = int(2.0 * SR)
    bed = x.copy()
    while len(bed) < need:                   # crossfade loop so the music never runs out early
        fade = np.linspace(0, 1, xf)[:, None]
        tail = bed[-xf:] * (1 - fade) + x[:xf] * fade
        bed = np.concatenate([bed[:-xf], tail, x[xf:]])
    bed = bed[:need]
    fl = int(1.0 * SR)
    bed[-fl:] *= np.linspace(1, 0, fl)[:, None] ** 2
    out = np.zeros((N, 2), dtype=np.float64)
    out[:need] = bed
    path = os.path.join(STEMS, 'music.wav')
    write(path, out)
    g = 10 ** ((-27.0 - lufs(path)) / 20)    # a bed under the narration
    write(path, out * g)
    print(f'music stem: {lufs(path):.1f} LUFS, ends at {end:.2f}s (looped: {len(x) < need})')
    return path


def ffmpeg_mix(inputs, filt, out):
    cmd = ['ffmpeg', '-y', '-v', 'error']
    for i in inputs:
        cmd += ['-i', i]
    cmd += ['-filter_complex', filt, '-map', '[out]', '-ar', str(SR), '-c:a', 'pcm_f32le', out]
    subprocess.run(cmd, check=True)


def measure(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    I = TP = None
    for line in r.stderr.splitlines():
        line = line.strip()
        if line.startswith('I:'):
            I = float(line.split()[1])
        if line.startswith('Peak:'):
            TP = float(line.split()[1])
    return I, TP


def loudnorm_2pass(src, dst, I=-16.0, TP=-1.5, LRA=11.0):
    """Gain to the target loudness, then a 4x-oversampled peak limiter (true-peak safe); iterate twice."""
    gain = 0.0
    for it in range(3):
        i0, _ = measure(src)
        g = gain + (I - i0)
        lim = 10 ** ((TP - 0.3) / 20)
        af = (f'volume={g:.2f}dB,aresample=192000,alimiter=limit={lim:.4f}:attack=2:release=60:level=false,'
              f'aresample=48000')
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', af, '-c:a', 'pcm_f32le', dst], check=True)
        i1, tp1 = measure(dst)
        gain = g + (I - i1) * 0.0
        if abs(i1 - I) < 0.2:
            break
        gain = g + (I - i1)
        # next iteration measures src again; correct the gain by the loss the limiter caused
        i0_src, _ = measure(src)
        gain = gain - (I - i0_src)
    i1, tp1 = measure(dst)
    print(f'    I: {i1:.1f} LUFS | true peak: {tp1:.1f} dBTP')


def main():
    preview = '--preview' in sys.argv
    voice = build_voice()
    music = build_music()
    sfx = os.path.join(STEMS, 'sfx.wav')
    have_sfx = os.path.exists(sfx) and not preview
    duck = 'sidechaincompress=threshold=0.035:ratio=6:attack=25:release=450:makeup=1'
    tmp = os.path.join(ROOT, 'audio', 'premix.wav')
    if have_sfx:
        filt = (f'[0:a]asplit=3[v][vs1][vs2];[1:a][vs1]{duck}[m];[2:a][vs2]sidechaincompress=threshold=0.05:ratio=3:attack=15:release=300[s];'
                f'[v][m][s]amix=inputs=3:normalize=0:duration=first[out]')
        ffmpeg_mix([voice, music, sfx], filt, tmp)
    else:
        filt = f'[0:a]asplit=2[v][vs1];[1:a][vs1]{duck}[m];[v][m]amix=inputs=2:normalize=0:duration=first[out]'
        ffmpeg_mix([voice, music], filt, tmp)
    out = os.path.join(ROOT, 'audio', 'mix.wav')
    print('mix (voice + music' + (' + sfx' if have_sfx else '') + '):')
    loudnorm_2pass(tmp, out)
    if have_sfx:
        filt = f'[0:a]asplit=2[v][vs];[1:a][vs]sidechaincompress=threshold=0.05:ratio=3:attack=15:release=300[s];[v][s]amix=inputs=2:normalize=0:duration=first[out]'
        ffmpeg_mix([voice, sfx], filt, tmp)
        out2 = os.path.join(ROOT, 'audio', 'mix_nomusic.wav')
        print('mix (voice + sfx, no music):')
        loudnorm_2pass(tmp, out2)
    os.remove(tmp)


if __name__ == '__main__':
    main()
