"""Shared motion model for SCP-3143 'Murphy Law' — kept in sync with app.js."""
import math

W, H = 685, 1259
HEAD_PIVOT = (352.0, 458.0)     # base of the skull, hidden behind the collar
HAND_PIVOT = (156.0, 495.0)     # wrist, hidden behind the cuff
CIG_TIP    = (243.0, 396.0)     # where the smoke comes off
SMOKE_CYCLE = 8.5               # seconds for one take-a-drag loop

def smoothstep(a, b, x):
    if b == a:
        return 0.0
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

def drag_curve(p):
    """0 = cigarette at the lips, 1 = hand pulled away. p is the cycle phase 0..1."""
    if p < 0.10:  return smoothstep(0.00, 0.10, p)          # pull away
    if p < 0.42:  return 1.0                                 # hold it out there
    if p < 0.52:  return 1 - smoothstep(0.42, 0.52, p)       # back to the lips
    return 0.0                                               # inhale, then idle

def inhale_curve(p):
    """peak right after the cigarette lands back on the lips — the actual drag"""
    return smoothstep(0.52, 0.58, p) * (1 - smoothstep(0.60, 0.78, p))

def blink(t):
    """0 = open, 1 = shut. Irregular singles with the occasional double."""
    # deterministic jitter, identical to app.js so the page and the film blink together
    h = lambda n: (math.sin(n * 12.9898) * 43758.5453) % 1.0
    v = 0.0
    for i in range(-1, 3):
        k = math.floor(t / 3.7) + i
        start = k * 3.7 + h(k) * 2.6
        starts = [start, start + 0.22] if h(k + 0.5) > 0.55 else [start]
        for s in starts:
            if s <= t < s + 0.16:
                v = max(v, math.sin((t - s) / 0.16 * math.pi) ** 0.6)
    return v

def pose(t, pulse, level):
    """pulse: 0..1 beat impulse, level: 0..1 smoothed loudness. Returns image-space units."""
    breath = math.sin(t * 2 * math.pi / 3.4)
    sway   = math.sin(t * 2 * math.pi / 5.3)
    p      = (t % SMOKE_CYCLE) / SMOKE_CYCLE
    drag   = drag_curve(p)
    inhale = inhale_curve(p)

    head = dict(
        # nods into the kick, drifts on the breath
        rot=0.75 * breath + 0.5 * sway - 2.1 * pulse + 1.3 * inhale,
        dx=1.6 * sway + 1.5 * pulse,
        dy=-1.8 * breath + 7.5 * pulse - 2.5 * inhale,
    )
    hand = dict(
        rot=-7.4 * drag + 0.45 * math.sin(t * 2.7) + 1.4 * pulse,
        dx=-2.0 * drag,
        dy=9.0 * drag + 2.0 * pulse,
    )
    stage = dict(
        zoom=1.0 + 0.017 * pulse + 0.004 * level,
        rot=0.30 * pulse * math.sin(t * 1.1),
    )
    return dict(head=head, hand=hand, stage=stage,
                blink=blink(t), drag=drag, inhale=inhale,
                smoke_sway=math.sin(t * 0.9) * 3.0)

def transform_point(px, py, pivot, rot_deg, dx, dy):
    """where a point on a layer ends up after rotate-about-pivot then translate"""
    r = math.radians(rot_deg)
    vx, vy = px - pivot[0], py - pivot[1]
    c, s = math.cos(r), math.sin(r)
    return (pivot[0] + vx * c - vy * s + dx,
            pivot[1] + vx * s + vy * c + dy)
