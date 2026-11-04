"""Walt Ep1 mix: ElevenLabs SFX (+ a few code-made UI ticks) + code-made music bed, ducked under the ElevenLabs voice."""
import importlib.util, json, os, subprocess, sys
import numpy as np
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('ma', os.path.join(here, 'make_audio.py')); ma = importlib.util.module_from_spec(spec); spec.loader.exec_module(ma)
SR = ma.SR
EL_DIR = os.path.join(here, '..', 'assets', 'el_sfx')
EL = {  # cue name -> (ElevenLabs file, max seconds, loop?)
    'ding': ('ding_1', 1.2, False), 'scream': ('scream_1', 1.6, False), 'cat': ('cat_1', 2.6, False), 'knee': ('knee_1', 1.0, False),
    'scratch': ('scratch_2', 1.0, False), 'notif': ('notif_1', 2.0, False), 'bingo': ('bingo_1', 0, True), 'whoosh': ('whoosh_1', 0.8, False),
    'typing': ('typing_2', 0, True), 'mailbox': ('mailbox_1', 1.0, False), 'chase': ('chase_1', 2.0, False), 'scooter': ('scooter_1', 1.0, False),
    'shutter': ('shutter_2', 0.8, False), 'rimshot': ('rimshot_1', 1.6, False), 'sting': ('sting_1', 2.0, False), 'boing': ('boing_2', 1.0, False),
    'grandmas': ('grandmas_1', 2.0, False),
}
GAIN = {'bingo': -10, 'typing': -6, 'whoosh': -4, 'notif': -2, 'chase': -1, 'grandmas': 0, 'ding': -4, 'shutter': -2, 'scratch': -2, 'rimshot': 0, 'sting': -2,
        'pop': -2, 'send': -5, 'slide': -2, 'tada': -4, 'zip': -6, 'stamp': 0, 'sparkle': -8, 'swoosh': -6, 'click': 0, 'confetti': -4, 'flip': -2, 'backspace': -8,
        'ticktock': -6, 'impact': -2}

def load_el(name):
    f = os.path.join(EL_DIR, EL[name][0] + '.mp3')
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(float)
    thr = np.abs(x).max() * 10 ** (-38 / 20)
    nz = np.where(np.abs(x) > thr)[0]
    if len(nz): x = x[max(0, nz[0] - int(0.004 * SR)): nz[-1] + int(0.05 * SR)]
    return x

def fit_len(x, dur, loop):
    n = int(dur * SR)
    if loop:
        xf = int(0.03 * SR); out = np.zeros(n); pos = 0
        while pos < n:
            seg = x.copy(); seg[:xf] *= np.linspace(0, 1, xf); seg[-xf:] *= np.linspace(1, 0, xf)
            j = min(n, pos + len(seg)); out[pos:j] += seg[:j - pos]; pos += len(seg) - xf
        return out
    if len(x) > n: x = x[:n].copy(); f = min(len(x), int(0.06 * SR)); x[-f:] *= np.linspace(1, 0, f)
    return x

def main():
    cues = json.load(open(sys.argv[1])); vo = ma.read_wav(sys.argv[2]); out = sys.argv[3]
    total = cues['dur']; n = int(total * SR)
    vo = np.concatenate([vo, np.zeros(max(0, n - len(vo)))])[:n]
    speech_rms = np.sqrt(np.mean(vo[np.abs(vo) > 0.02] ** 2))
    sfx = np.zeros(n + int(4 * SR)); used = {}
    cache = {}
    for c in cues['cues']:
        name = c['name']
        if name in EL:
            if name not in cache: cache[name] = load_el(name)
            x = cache[name]; mx = EL[name][1]
            if 'dur' in c: x = fit_len(x, max(0.3, c['dur']), EL[name][2])
            elif mx: x = fit_len(x, mx, False)
            src = 'elevenlabs'
        elif name in ma.DUR_SFX and 'dur' in c: x = ma.DUR_SFX[name](max(0.2, c['dur'])); src = 'code'
        elif name in ma.SFX: x = ma.SFX[name](); src = 'code'
        else: print('MISSING', name); continue
        x = np.asarray(x, float); x = x - x.mean()
        rms = np.sqrt(np.mean(x ** 2)) + 1e-9; pk = np.abs(x).max() + 1e-9
        g = min(speech_rms * 0.6 / rms, 0.8 / pk) * c.get('vol', 1) * 10 ** (GAIN.get(name, 0) / 20)
        ma.place(sfx, x * g, c['t']); used[name] = src
    sfx = sfx[:n]
    mus = ma.build_music(cues['music'], total)
    mrms = np.sqrt(np.mean(mus[np.abs(mus) > 1e-4] ** 2)) + 1e-9
    mus *= speech_rms * 10 ** (-17 / 20) / mrms
    ve = np.array(ma.envelope(vo, 0.02, 0.35)); mus *= 1 - 0.55 * np.clip(ve / (speech_rms * 0.6), 0, 1)
    mix = vo + sfx + mus
    pk = np.abs(mix).max(); mix = mix / pk * 0.95 if pk > 0.95 else mix
    mix = np.tanh(mix * 1.2) / np.tanh(1.2)
    ma.write_wav(out, mix)
    print('sources:', json.dumps(used, sort_keys=True))
    for nm, x in (('vo', vo), ('sfx', sfx), ('music', mus), ('mix', mix)):
        r = np.sqrt(np.mean(x ** 2)); print(f'{nm:6s} rms {20*np.log10(r+1e-12):6.1f} dBFS  peak {20*np.log10(np.abs(x).max()+1e-12):6.1f} dBFS')

if __name__ == '__main__':
    main()
