"""Rebuild CMU ASF/AMC files from the Hugging Face mirror codepawl/cmu-mocap-glb (`skeleton/` tier).

Use this when mocap.cs.cmu.edu is unreachable. The skeleton GLBs are the CMU 31-bone skeleton in BVH form
(identity rest rotations, joint offsets = ASF bone vectors in metres, *_end nodes for leaf bones) with the
original joint rotations at 60 fps. We write
  - <subj>.asf: each bone's direction/length from its child offset, axis 0 0 0, dof rx ry rz;
  - <clip>.amc: per frame, root position (ASF units) and each bone's local rotation as XYZ Euler degrees,
    slerp-upsampled to 120 fps so frame numbers match the original CMU files (shots.py uses e.g. 137_41 @ 4150).
With axis = identity, mocap.frame_globals (R = R_parent @ Euler) reproduces the GLB's global rotations exactly.

Usage: python glb2amc.py <clip.glb> <clip_id> <out_dir>      (needs numpy + pygltflib)
"""
import os, sys, math
import numpy as np
from pygltflib import GLTF2

UNIT = (1.0 / 0.45) * 0.0254   # metres per ASF length unit (same constant as mocap.py)

COMP = {5126: (np.float32, 4), 5123: (np.uint16, 2), 5121: (np.uint8, 1), 5122: (np.int16, 2), 5120: (np.int8, 1)}
NCOMP = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}


def read_accessor(g, blob, idx):
    acc = g.accessors[idx]
    bv = g.bufferViews[acc.bufferView]
    dt, size = COMP[acc.componentType]
    n = NCOMP[acc.type]
    off = (bv.byteOffset or 0) + (acc.byteOffset or 0)
    stride = bv.byteStride or size * n
    raw = np.frombuffer(blob, dtype=np.uint8, count=stride * (acc.count - 1) + size * n, offset=off)
    out = np.lib.stride_tricks.as_strided(raw, shape=(acc.count, size * n), strides=(stride, 1)).copy()
    a = out.view(dt).reshape(acc.count, n).astype(np.float64)
    if acc.normalized:
        a /= {np.uint16: 65535.0, np.uint8: 255.0, np.int16: 32767.0, np.int8: 127.0}[dt]
    return a


def quat_to_mat(q):  # q = (x, y, z, w)
    x, y, z, w = q / np.linalg.norm(q)
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def mat_to_euler_xyz(R):
    """Angles (a, b, c) with R = Rz(c) @ Ry(b) @ Rx(a) (X applied first, mocap.euler_xyz), degrees."""
    b = math.asin(max(-1.0, min(1.0, -R[2, 0])))
    if abs(math.cos(b)) > 1e-6:
        a = math.atan2(R[2, 1], R[2, 2]); c = math.atan2(R[1, 0], R[0, 0])
    else:  # gimbal lock
        a = math.atan2(-R[1, 2], R[1, 1]); c = 0.0
    return [math.degrees(a), math.degrees(b), math.degrees(c)]


def slerp(q0, q1, t):
    d = float(np.dot(q0, q1))
    if d < 0:
        q1, d = -q1, -d
    if d > 0.9995:
        q = q0 + t * (q1 - q0)
    else:
        th = math.acos(d)
        q = (math.sin((1 - t) * th) * q0 + math.sin(t * th) * q1) / math.sin(th)
    return q / np.linalg.norm(q)


def convert(glb, clip, out_dir):
    g = GLTF2().load(glb)
    blob = g.binary_blob()
    nodes = g.nodes
    name = [n.name for n in nodes]
    parent = {c: i for i, n in enumerate(nodes) for c in (n.children or [])}
    for n in nodes:
        assert not n.rotation or np.allclose(n.rotation, [0, 0, 0, 1], atol=1e-6), f"non-identity rest on {n.name}"
    bones = [i for i, nm in enumerate(name) if not nm.endswith("_end") and nm != "root"]
    root = name.index("root")

    # ---- ASF
    hier = {}
    lines = [":version 1.10", ":name VICON", ":units", "  mass 1.0", "  length 0.45", "  angle deg",
             ":documentation", f"  rebuilt from {os.path.basename(glb)} by glb2amc.py (codepawl/cmu-mocap-glb)",
             ":root", "   order TX TY TZ RX RY RZ", "   axis XYZ", "   position 0 0 0", "   orientation 0 0 0",
             ":bonedata"]
    for k, i in enumerate(bones, 1):
        kids = nodes[i].children or []
        off = np.array(nodes[kids[0]].translation if kids else [0, 0, 0], dtype=np.float64)
        L = float(np.linalg.norm(off))
        d = off / L if L > 1e-9 else np.array([0.0, 1.0, 0.0])
        lines += ["  begin", f"     id {k}", f"     name {name[i]}",
                  f"     direction {d[0]:.6f} {d[1]:.6f} {d[2]:.6f}", f"     length {L / UNIT:.6f}",
                  "     axis 0 0 0  XYZ", "     dof rx ry rz", "  end"]
    lines += [":hierarchy", "  begin"]
    for i, n in enumerate(nodes):
        kids = [name[c] for c in (n.children or []) if not name[c].endswith("_end")]
        if kids:
            lines.append(f"    {name[i]} {' '.join(kids)}")
            hier[name[i]] = kids
    lines += ["  end"]
    # start offsets of root children must be zero (ASF bones start at the parent's end)
    for c in nodes[root].children or []:
        assert np.allclose(nodes[c].translation or [0, 0, 0], 0, atol=1e-6), name[c]
    for i in bones:
        for c in nodes[i].children or []:
            if not name[c].endswith("_end"):
                first = nodes[(nodes[i].children or [])[0]].translation
                assert np.allclose(nodes[c].translation, first, atol=1e-5), (name[i], name[c])
    subj = clip.split("_")[0]
    os.makedirs(out_dir, exist_ok=True)
    asf_path = os.path.join(out_dir, f"{subj}.asf")
    open(asf_path + ".new", "w").write("\n".join(lines) + "\n")

    # ---- animation
    anim = g.animations[0]
    rot, root_pos, times = {}, None, None
    for ch in anim.channels:
        s = anim.samplers[ch.sampler]
        t = read_accessor(g, blob, s.input)[:, 0]
        v = read_accessor(g, blob, s.output)
        if times is None or len(t) > len(times):
            times = t
        if ch.target.path == "rotation":
            rot[ch.target.node] = (t, v)
        elif ch.target.path == "translation" and ch.target.node == root:
            root_pos = (t, v)
    n60 = len(times)
    fps = (n60 - 1) / (times[-1] - times[0])
    assert abs(fps - 60) < 0.5, fps

    def sample_q(node, k):
        if node not in rot:
            return np.array([0, 0, 0, 1.0])
        t, v = rot[node]
        return v[min(k, len(v) - 1)]

    def sample_p(k):
        if root_pos is None:
            return np.array(nodes[root].translation, dtype=np.float64)
        return root_pos[1][min(k, len(root_pos[1]) - 1)]

    out = [":FULLY-SPECIFIED", ":DEGREES"]
    fr = 0
    for k in range(n60):
        for half in ((0.0, 0.5) if k < n60 - 1 else (0.0,)):
            fr += 1
            out.append(str(fr))
            k1 = min(k + 1, n60 - 1)
            p = sample_p(k) * (1 - half) + sample_p(k1) * half
            qr = slerp(sample_q(root, k), sample_q(root, k1), half)
            e = mat_to_euler_xyz(quat_to_mat(qr))
            out.append("root " + " ".join(f"{x:.5f}" for x in list(p / UNIT) + e))
            for i in bones:
                q = slerp(sample_q(i, k), sample_q(i, k1), half)
                out.append(name[i] + " " + " ".join(f"{x:.5f}" for x in mat_to_euler_xyz(quat_to_mat(q))))
    amc_path = os.path.join(out_dir, f"{clip}.amc")
    open(amc_path, "w").write("\n".join(out) + "\n")
    # keep one ASF per subject; clips of the same subject must agree
    if os.path.exists(asf_path):
        a = open(asf_path).read().split(":bonedata")[1]
        b = open(asf_path + ".new").read().split(":bonedata")[1]
        if a != b:
            print("WARNING: skeleton of", clip, "differs from existing", asf_path, "(kept the existing one)")
        os.remove(asf_path + ".new")
    else:
        os.rename(asf_path + ".new", asf_path)
    print(f"{clip}: {n60} frames @60 -> {fr} frames @120  ->  {amc_path}, {asf_path}")
    return asf_path, amc_path


if __name__ == "__main__":
    convert(sys.argv[1], sys.argv[2], sys.argv[3])
