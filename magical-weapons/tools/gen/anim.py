"""Keyframe authoring helpers -> Bedrock animation JSON.

Poses are authored as a handful of key poses per bone with an easing curve per segment,
then sampled densely into linear keyframes (robust: needs no special lerp modes).

Rotation numbers follow Bedrock's convention for the *canonical frame* of a weapon
(+Y tip, -Z front edge, X = flat-face normal):
    rot X +  -> tip pitches forward (edge leads)       rot Y -> roll about the blade axis
    rot Z +  -> tip leans sideways (towards +X)
"""
import math


# ------------------------------------------------------------------ easing
def _ease(kind, t):
    t = max(0.0, min(1.0, t))
    if kind == 'linear':
        return t
    if kind == 'in':      # accelerate (strike)
        return t * t * t
    if kind == 'in2':
        return t * t
    if kind == 'out':     # decelerate (settle)
        return 1 - (1 - t) ** 3
    if kind == 'out2':
        return 1 - (1 - t) ** 2
    if kind == 'smooth':
        return t * t * (3 - 2 * t)
    if kind == 'smoother':
        return t * t * t * (t * (6 * t - 15) + 10)
    if kind == 'back':    # slight overshoot then settle
        c1 = 1.2
        c3 = c1 + 1
        return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
    if kind == 'hold':    # keep previous value until the next key
        return 0.0 if t < 1 else 1.0
    raise ValueError('unknown ease ' + kind)


class Key:
    """A key pose. `ease` shapes the segment that STARTS at this key."""
    def __init__(self, t, rot=(0, 0, 0), pos=(0, 0, 0), ease='smooth'):
        self.t = t
        self.rot = tuple(rot)
        self.pos = tuple(pos)
        self.ease = ease


def sample(keys, t, field):
    """Value of `field` ('rot'|'pos') at time t."""
    if t <= keys[0].t:
        return getattr(keys[0], field)
    if t >= keys[-1].t:
        return getattr(keys[-1], field)
    for a, b in zip(keys, keys[1:]):
        if a.t <= t <= b.t:
            u = _ease(a.ease, (t - a.t) / (b.t - a.t))
            va, vb = getattr(a, field), getattr(b, field)
            return tuple(va[i] + (vb[i] - va[i]) * u for i in range(3))
    return getattr(keys[-1], field)


def _fmt(t):
    s = '%.4f' % t
    s = s.rstrip('0').rstrip('.')
    return s if '.' in s else s + '.0'


def _num(v):
    r = round(v, 3)
    return 0 if r == 0 else r


def dense_channel(keys, field, length, fps=48):
    """Dense linear keyframes for one channel; None if the channel is all zeros."""
    n = max(2, int(math.ceil(length * fps)))
    frames = {}
    nonzero = False
    for i in range(n + 1):
        t = min(length, i * length / n)
        v = sample(keys, t, field)
        if any(abs(c) > 1e-6 for c in v):
            nonzero = True
        frames[_fmt(t)] = [_num(c) for c in v]
    return frames if nonzero else None


def timeline_animation(bones, length, time_expr=None, loop='hold_on_last_frame', fps=48):
    """bones: {name: [Key, ...]} -> animation dict. time_expr drives the clock (anim_time_update)."""
    out = {'loop': loop, 'animation_length': round(length, 4)}
    if time_expr:
        out['anim_time_update'] = time_expr
    ob = {}
    for name, keys in bones.items():
        ch = {}
        rot = dense_channel(keys, 'rot', length, fps)
        pos = dense_channel(keys, 'pos', length, fps)
        if rot:
            ch['rotation'] = rot
        if pos:
            ch['position'] = pos
        if ch:
            ob[name] = ch
    out['bones'] = ob
    return out


def scaled_keys(keys, amp_rot=1.0, amp_pos=1.0):
    return [Key(k.t, [c * amp_rot for c in k.rot], [c * amp_pos for c in k.pos], k.ease) for k in keys]
