"""Tiny numpy software rasterizer for Bedrock cube models (preview only)."""
import math
import numpy as np
from PIL import Image

from .rig import euler_internal


def _face_corners(frm, to, face):
    """Corners (TL, TR, BR, BL as seen from outside) + outward normal."""
    x0, y0, z0 = frm
    x1, y1, z1 = to
    if face == "north":   # -Z, viewer right = -X
        return [(x1, y1, z0), (x0, y1, z0), (x0, y0, z0), (x1, y0, z0)], (0, 0, -1)
    if face == "south":   # +Z, viewer right = +X
        return [(x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1)], (0, 0, 1)
    if face == "east":    # +X, viewer right = -Z
        return [(x1, y1, z1), (x1, y1, z0), (x1, y0, z0), (x1, y0, z1)], (1, 0, 0)
    if face == "west":    # -X, viewer right = +Z
        return [(x0, y1, z0), (x0, y1, z1), (x0, y0, z1), (x0, y0, z0)], (-1, 0, 0)
    if face == "up":      # +Y, v=0 at north edge
        return [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], (0, 1, 0)
    if face == "down":    # -Y
        return [(x1, y0, z0), (x0, y0, z0), (x0, y0, z1), (x1, y0, z1)], (0, -1, 0)
    raise ValueError(face)


def collect_quads(model, mats, texture=None, color=None, skip_bones=()):
    """Return list of (verts[4x3], uvs[4x2], normal, tex, color)."""
    quads = []
    for bname in model.order:
        if bname in skip_bones:
            continue
        bone = model.bones[bname]
        M = mats[bname]
        for c in bone.cubes:
            for face, rect in c.faces.items():
                if rect is None:
                    continue
                corners, normal = _face_corners(c.frm, c.to, face)
                v = np.array(corners, dtype=float)
                n = np.array(normal, dtype=float)
                if c.rot is not None:
                    R = euler_internal(c.rot)
                    v = (v - c.pivot) @ R.T + c.pivot
                    n = R @ n
                v4 = np.hstack([v, np.ones((4, 1))]) @ M.T
                n = M[:3, :3] @ n
                u, vv, w, h = rect
                uvs = np.array([[u, vv], [u + w, vv], [u + w, vv + h], [u, vv + h]], dtype=float)
                if texture is not None:
                    sx = texture.shape[1] / model.tex_w
                    sy = texture.shape[0] / model.tex_h
                    uvs = uvs * [sx, sy]
                quads.append((v4[:, :3], uvs, n, texture, c.color or color))
    return quads


class Renderer:
    def __init__(self, width, height, fov_v=70.0, near=0.5, bg=(0, 0, 0, 0), ss=2):
        self.ss = ss
        self.W = width * ss
        self.H = height * ss
        self.out_size = (width, height)
        self.f = (self.H / 2) / math.tan(math.radians(fov_v) / 2)
        self.near = near
        self.color = np.zeros((self.H, self.W, 4), dtype=float)
        self.color[:] = np.array(bg, dtype=float) / 255.0
        self.depth = np.full((self.H, self.W), np.inf)
        self.light = np.array([-0.35, 0.8, -0.45])
        self.light /= np.linalg.norm(self.light)
        self.ortho = None

    def set_ortho(self, scale):
        """Orthographic projection: pixels per model unit."""
        self.ortho = scale * self.ss

    def _project(self, p):
        if self.ortho:
            sx = self.W / 2 + p[:, 0] * self.ortho
            sy = self.H / 2 - p[:, 1] * self.ortho
            return np.stack([sx, sy], axis=1), p[:, 2]
        z = p[:, 2]
        sx = self.W / 2 + self.f * p[:, 0] / z
        sy = self.H / 2 - self.f * p[:, 1] / z
        return np.stack([sx, sy], axis=1), z

    def draw(self, quads, cam):
        R = cam[:3, :3]
        t = cam[:3, 3]
        for verts, uvs, normal, tex, color in quads:
            p = verts @ R.T + t
            n = R @ normal
            nl = np.linalg.norm(n)
            if nl < 1e-9:
                continue
            n = n / nl
            # back-face culling
            if self.ortho:
                if n[2] > 0:
                    continue
            else:
                if np.dot(n, p[0]) > 0:
                    continue
            # camera-space light direction (towards the light)
            shade = 0.45 + 0.55 * max(0.0, float(np.dot(n, self.light)))
            for tri in ((0, 1, 2), (0, 2, 3)):
                self._tri(p[list(tri)], uvs[list(tri)], tex, color, shade)

    def _clip_near(self, p, uv):
        if self.ortho:
            return [(p, uv)]
        inside = p[:, 2] >= self.near
        if inside.all():
            return [(p, uv)]
        if not inside.any():
            return []
        poly_p, poly_uv = [], []
        for i in range(3):
            j = (i + 1) % 3
            pi, pj = p[i], p[j]
            ui, uj = uv[i], uv[j]
            if inside[i]:
                poly_p.append(pi)
                poly_uv.append(ui)
            if inside[i] != inside[j]:
                tt = (self.near - pi[2]) / (pj[2] - pi[2])
                poly_p.append(pi + tt * (pj - pi))
                poly_uv.append(ui + tt * (uj - ui))
        out = []
        for k in range(1, len(poly_p) - 1):
            out.append((np.array([poly_p[0], poly_p[k], poly_p[k + 1]]),
                        np.array([poly_uv[0], poly_uv[k], poly_uv[k + 1]])))
        return out

    def _tri(self, p, uv, tex, color, shade):
        for cp, cuv in self._clip_near(p, uv):
            self._raster(cp, cuv, tex, color, shade)

    def _raster(self, p, uv, tex, color, shade):
        s, z = self._project(p)
        x0 = max(int(math.floor(s[:, 0].min())), 0)
        x1 = min(int(math.ceil(s[:, 0].max())), self.W - 1)
        y0 = max(int(math.floor(s[:, 1].min())), 0)
        y1 = min(int(math.ceil(s[:, 1].max())), self.H - 1)
        if x1 < x0 or y1 < y0:
            return
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, ay), (bx, by), (cx, cy) = s
        area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
        if abs(area) < 1e-9:
            return
        w0 = ((bx - xs) * (cy - ys) - (by - ys) * (cx - xs)) / area
        w1 = ((cx - xs) * (ay - ys) - (cy - ys) * (ax - xs)) / area
        w2 = 1.0 - w0 - w1
        mask = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not mask.any():
            return
        if self.ortho:
            iz = w0 * z[0] + w1 * z[1] + w2 * z[2]
            depth = iz
            u = w0 * uv[0, 0] + w1 * uv[1, 0] + w2 * uv[2, 0]
            v = w0 * uv[0, 1] + w1 * uv[1, 1] + w2 * uv[2, 1]
        else:
            iz = w0 / z[0] + w1 / z[1] + w2 / z[2]
            depth = 1.0 / iz
            u = (w0 * uv[0, 0] / z[0] + w1 * uv[1, 0] / z[1] + w2 * uv[2, 0] / z[2]) / iz
            v = (w0 * uv[0, 1] / z[0] + w1 * uv[1, 1] / z[1] + w2 * uv[2, 1] / z[2]) / iz
        sub_depth = self.depth[y0:y1 + 1, x0:x1 + 1]
        mask &= depth < sub_depth
        if not mask.any():
            return
        if tex is not None and color is None:
            th, tw = tex.shape[:2]
            ui = np.clip(np.floor(u - 1e-4).astype(int), 0, tw - 1)
            vi = np.clip(np.floor(v - 1e-4).astype(int), 0, th - 1)
            px = tex[vi, ui]
            mask &= px[..., 3] > 0.5
            rgb = px[..., :3]
        else:
            col = np.array(color if color is not None else (200, 200, 200), dtype=float) / 255.0
            rgb = np.broadcast_to(col[:3], u.shape + (3,))
        if not mask.any():
            return
        sub_col = self.color[y0:y1 + 1, x0:x1 + 1]
        sub_col[mask, :3] = rgb[mask] * shade
        sub_col[mask, 3] = 1.0
        sub_depth[mask] = depth[mask]

    def image(self):
        img = Image.fromarray(np.clip(self.color * 255, 0, 255).astype(np.uint8), "RGBA")
        if self.ss > 1:
            img = img.resize(self.out_size, Image.LANCZOS)
        return img
