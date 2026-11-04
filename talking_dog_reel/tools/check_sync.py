#!/usr/bin/env python3
"""Check captions against the voice: every place the speech resumes after a
pause must have a caption appearing within 0.1 s."""
import json, re, subprocess, sys
tl = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'build/timeline.json'))
voice = sys.argv[2] if len(sys.argv) > 2 else 'voice/my_voiceover.mp3'
out = subprocess.run(['ffmpeg', '-v', 'info', '-i', voice, '-af', 'silencedetect=noise=-35dB:d=0.18', '-f', 'null', '-'],
                     capture_output=True, text=True).stderr
ends = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', out) if float(x) < tl['duration'] - 0.2]
caps = [c['s'] + 0.03 for c in tl['captions']]
bad = 0
for e in ends:
    d = min(caps, key=lambda c: abs(c - e))
    if abs(d - e) >= 0.1:
        bad += 1
        print(f"  speech resumes {e:6.2f}s  nearest caption {d:6.2f}s  ({d - e:+.2f}s)")
print(f"{len(ends) - bad}/{len(ends)} speech onsets have a caption within 0.1 s; duration {tl['duration']}s")
