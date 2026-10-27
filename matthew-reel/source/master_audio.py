"""gain + lookahead limiter, iterated to -14.0 LUFS integrated, true peak <= -1.5 dBTP -> mix_final.wav"""
import json, subprocess, os, re
import sys
HERE = os.path.dirname(os.path.abspath(__file__))
D = sys.argv[1] if len(sys.argv) > 1 else HERE
src = os.path.join(D, 'mix_raw.wav')
out = os.path.join(D, 'mix_final.wav')

def measure(path):
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True)
    s = p.stderr[p.stderr.rindex('Summary'):]
    I = float(re.search(r'I:\s+(-?[\d.]+) LUFS', s).group(1))
    tp = float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', s).group(1))
    return I, tp

gain = 0.0
I0, tp0 = measure(src)
gain = -14.0 - I0
for it in range(4):
    af = f'volume={gain:.3f}dB,alimiter=limit=0.80:attack=3:release=70:level=disabled:asc=1'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', af, '-ar', '48000', '-c:a', 'pcm_s24le', out], check=True)
    I, tp = measure(out)
    print(f'iter {it}: gain {gain:+.2f} dB -> I {I:.2f} LUFS, TP {tp:.2f} dBTP')
    if abs(I + 14.0) < 0.05:
        break
    gain += -14.0 - I
