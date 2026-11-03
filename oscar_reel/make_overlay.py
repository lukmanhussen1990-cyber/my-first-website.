#!/usr/bin/env python3
"""Timer overlays for the awards reel, added to audio/captions.ass (run after make_captions.py + add_labels.py).
  1. a small stopwatch in the top-right corner from "What you don't know" (shot 26) to the play-off music:
     a white dial with a ticking red hand + the speech time under it (0:31 ... 0:40 ... 0:44 ... 0:45, red from 0:40).
  2. the big glowing COUNTDOWN numbers 0:40 / 0:44 / 0:45 (shots 31-33), above the captions.
The speech-time mapping is shared with the 3D stopwatch (web/shots_a.js stopwatchK)."""
import json, math, re

ASS = 'audio/captions.ass'
SHOTS = {f"s{int(s['id']):02d}": s for s in json.load(open('shots.json'))['shots']}
TAG = 'ovl'          # Name field of every overlay event (so re-runs replace them)


def speech_secs(t):
    """seconds of his speech shown on the stopwatch at video time t"""
    if t < 42.66: return 31 + (t - 33.5) * (9 / 9.16)
    if t < 44.10: return 40 + (t - 42.66) / 1.44 * 4
    if t < 45.44: return 44 + (t - 44.10) / 1.34
    return 45.0


def ts(t):
    t = max(0.0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'


def circle(r):
    k = 0.5523 * r
    return (f'm {r:.0f} 0 b {r + k:.0f} 0 {2 * r:.0f} {r - k:.0f} {2 * r:.0f} {r:.0f} b {2 * r:.0f} {r + k:.0f} {r + k:.0f} {2 * r:.0f} {r:.0f} {2 * r:.0f} '
            f'b {r - k:.0f} {2 * r:.0f} 0 {r + k:.0f} 0 {r:.0f} b 0 {r - k:.0f} {r - k:.0f} 0 {r:.0f} 0')


def ev(layer, t0, t1, text, style='Caption'):
    return f'Dialogue: {layer},{ts(t0)},{ts(t1)},{style},{TAG},0,0,0,,{text}'


def main():
    lines = [l for l in open(ASS).read().splitlines() if f',{TAG},' not in l]
    out = []
    # ---------------------------------------------------------------- 1. corner stopwatch
    T0 = SHOTS['s26']['t0'] + 0.25 if 's26' in SHOTS else 33.75
    T1 = SHOTS['s34']['t1'] if 's34' in SHOTS else 47.9
    CX, CY, R = 905, 330, 70
    pop = r'\fscx40\fscy40\t(0,160,\fscx100\fscy100)'
    out.append(ev(10, T0, T1, rf'{{\an7\pos({CX - R},{CY - R})\1c&HFFFFFF&\3c&H14100E&\bord7\shad0\blur0.6\org({CX},{CY}){pop}\p1}}{circle(R)}'))
    out.append(ev(10, T0, T1, rf'{{\an7\pos({CX - 14},{CY - R - 30})\1c&HD8D4D0&\3c&H14100E&\bord5\shad0\org({CX},{CY}){pop}\p1}}m 0 0 l 28 0 l 28 26 l 0 26'))
    for i in range(12):            # dial ticks
        a = i / 12 * 2 * math.pi
        x, y = CX + math.sin(a) * (R - 12), CY - math.cos(a) * (R - 12)
        out.append(ev(11, T0, T1, rf'{{\an5\pos({x:.0f},{y:.0f})\1c&H3A3430&\bord0\shad0\org({CX},{CY}){pop}\p1}}m 0 0 l 6 0 l 6 6 l 0 6'))
    # the red hand + the time label: one event per displayed second
    t = T0
    while t < T1 - 1e-3:
        s = int(math.floor(speech_secs(t) + 1e-6))
        # next change: step 1/50 s until the shown second changes
        t2 = t
        while t2 < T1 and int(math.floor(speech_secs(t2) + 1e-6)) == s: t2 += 0.02
        t2 = min(t2, T1)
        ang = -(s % 60) / 60 * 360
        red = s >= 40
        out.append(ev(12, t, t2, rf'{{\an2\pos({CX},{CY})\org({CX},{CY})\frz{ang:.1f}\1c&H2020E0&\bord0\shad0\p1}}m 0 0 l 7 0 l 7 60 l 0 60'))
        out.append(ev(13, t, t2, rf'{{\an5\pos({CX},{CY})\1c&H14100E&\bord0\shad0\p1}}m 0 0 l 14 0 l 14 14 l 0 14'))
        col = r'\1c&H3030FF&\3c&HFFFFFF&' if red else r'\1c&HFFFFFF&\3c&H14100E&'
        flash = r'\t(0,120,\fscx125\fscy125)\t(120,260,\fscx100\fscy100)' if red else ''
        out.append(ev(12, t, t2, rf'{{\an5\pos({CX},{CY + R + 52})\fs58\bord6{col}{flash}}}0:{s:02d}'))
        t = t2
    # ---------------------------------------------------------------- 2. the big COUNTDOWN numbers
    for sid, label, red in (('s31', '0:40', False), ('s32', '0:44', False), ('s33', '0:45', True)):
        if sid not in SHOTS: continue
        a, b = SHOTS[sid]['t0'], SHOTS[sid]['t1']
        core = r'\1c&H3030FF&' if red else r'\1c&H60F0FF&'
        glow = r'\3c&H0020FF&' if red else r'\3c&H0070FF&'
        popin = r'\fscx150\fscy150\t(0,110,\fscx100\fscy100)'
        out.append(ev(14, a, b, rf'{{\an5\pos(540,385)\fs220{glow}\1c&H0070FF&\bord22\blur18\shad0{popin}}}{label}'))
        out.append(ev(15, a, b, rf'{{\an5\pos(540,385)\fs220{core}\3c&H14100E&\bord9\shad0{popin}}}{label}'))
        if red:   # 0:45 blinks
            for k in range(6):
                out.append(ev(16, a + 0.4 + k * 0.16, a + 0.48 + k * 0.16, r'{\an5\pos(540,385)\fs220\1c&HFFFFFF&\3c&H14100E&\bord9\shad0}0:45'))
    open(ASS, 'w').write('\n'.join(lines + out) + '\n')
    print(f'overlay: {len(out)} events ({T0:.2f}-{T1:.2f} s stopwatch)')


if __name__ == '__main__':
    main()
