"""Print surface profiles of the head SDF (for tuning numbers quickly)."""
import sys
import numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0])
import body_def as B  # noqa


def front_y(f, x, z, y0=-0.2, y1=0.12):
    ys = np.linspace(y0, y1, 3201)
    P = np.stack([np.full_like(ys, x), ys, np.full_like(ys, z)], 1)
    d = f(P)
    i = np.nonzero(d < 0)[0]
    return ys[i[0]] if len(i) else np.nan


def side_x(f, y, z):
    xs = np.linspace(0.12, 0.0, 2401)
    P = np.stack([xs, np.full_like(xs, y), np.full_like(xs, z)], 1)
    d = f(P)
    i = np.nonzero(d < 0)[0]
    return xs[i[0]] if len(i) else np.nan


skin, P = B.build_skin()
print('midline profile (z: front y)')
for z in [1.688, 1.66, 1.64, 1.62, 1.60, 1.59, 1.581, 1.57, 1.555, 1.545, 1.535, 1.528, 1.52, 1.515,
          1.505, 1.497, 1.49, 1.48, 1.47, 1.46, 1.452, 1.448]:
    print(f'  z={z:.3f}  y={front_y(skin, 0.0, z):+.4f}')
for zz, label in [(1.571, 'eye level'), (1.533, 'nose tip level'), (1.497, 'mouth level')]:
    print(label)
    for x in [0.0, 0.008, 0.014, 0.018, 0.024, 0.032, 0.040, 0.047, 0.055, 0.062, 0.068, 0.072]:
        print(f'  x={x:.3f}  y={front_y(skin, x, zz):+.4f}')
print('widths (half) at y=0')
for z in [1.66, 1.62, 1.60, 1.57, 1.54, 1.50, 1.47]:
    print(f'  z={z:.3f}  x={side_x(skin, 0.0, z):.4f}  (y=-0.04: {side_x(skin, -0.04, z):.4f})')
E = B.EYE_C
print('eye apex y', E[1] - B.EYE_R)
