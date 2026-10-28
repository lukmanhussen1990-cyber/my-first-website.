"""Mesh every SDF part of the caveman into assets/parts.npz"""
import sys, time, numpy as np
sys.path.insert(0, '/home/user/work/scripts')
from sdf import mesh_sdf
import char_geo as G

res = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
out = {}
t = time.time()
body, L = G.body_prims()
V, F = mesh_sdf(body, (-0.82, -0.3, -0.01), (0.82, 0.25, 1.9), 0.003 * res, block=80)
out['body_V'], out['body_F'] = V, F
print('body', time.time() - t)

V, F = mesh_sdf(G.beard_prims(), (-0.16, -0.2, 1.38), (0.16, 0.06, 1.8), 0.0025 * res,
                extra=lambda p, d: d + 0.0045 * G.snoise(p, 70) + 0.002 * G.snoise(p * 1.7 + 3, 140))
out['beard_V'], out['beard_F'] = V, F
V, F = mesh_sdf(G.mustache_prims(), (-0.07, -0.14, 1.62), (0.07, -0.07, 1.70), 0.0012 * res,
                extra=lambda p, d: d + 0.0015 * G.snoise(p, 160))
out['must_V'], out['must_F'] = V, F
V, F = mesh_sdf(G.hair_prims(), (-0.17, -0.12, 1.42), (0.17, 0.2, 1.95), 0.003 * res,
                extra=lambda p, d: d + 0.006 * G.snoise(p, 45) + 0.0025 * G.snoise(p * 1.3 + 5, 120))
out['hair_V'], out['hair_F'] = V, F
V, F = mesh_sdf(G.brow_prims(), (-0.08, -0.12, 1.75), (0.08, -0.06, 1.80), 0.001 * res,
                extra=lambda p, d: d + 0.001 * G.snoise(p, 300))
out['brow_V'], out['brow_F'] = V, F
V, F = mesh_sdf(G.tunic_prims(body), (-0.36, -0.3, 0.6), (0.36, 0.25, 1.66), 0.004 * res, block=80)
out['tunic_V'], out['tunic_F'] = V, F
print('total', time.time() - t)
np.savez('/home/user/work/assets/parts.npz', **out)
