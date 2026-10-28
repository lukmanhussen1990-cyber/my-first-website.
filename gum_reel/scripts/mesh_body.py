import sys, time, numpy as np
sys.path.insert(0, '/home/user/work/scripts')
from sdf import mesh_sdf
from char_geo import body_prims
step = float(sys.argv[1]) if len(sys.argv) > 1 else 0.003
P, L = body_prims()
t = time.time()
V, F = mesh_sdf(P, (-0.82, -0.3, -0.01), (0.82, 0.25, 1.9), step, block=80)
print('time', time.time() - t)
np.savez('/home/user/work/assets/body_raw.npz', V=V, F=F)
