"""Shared helpers for the Horizon Glow build scripts.

Everything here is pure numpy + Pillow so the pack can be regenerated on any
machine:   python3 -I tools/build.py --vanilla <path to bedrock-samples>/resource_pack
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent            # minecraft-graphics-mod/
PACK_NAME = "HorizonGlow_RP"
PACK_DIR = ROOT / "pack" / PACK_NAME

PRESETS = ("lite", "standard", "ultra")


# --------------------------------------------------------------------------
# colour science (OKLab) -- used so grading is perceptual and hue-stable
# --------------------------------------------------------------------------
def srgb_to_linear(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def rgb_to_oklab(rgb):
    """rgb: (...,3) floats 0..1 (sRGB) -> (...,3) L,a,b"""
    lin = srgb_to_linear(rgb)
    r, g, b = lin[..., 0], lin[..., 1], lin[..., 2]
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    return np.stack([
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    ], axis=-1)


def _oklab_to_linear(lab):
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    return np.stack([
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ], axis=-1)


def oklab_to_rgb(lab, gamut_clip=True):
    """OKLab -> sRGB 0..1. Out-of-gamut colours get their chroma reduced
    (never hue-shifted) so saturation boosts can't produce neon clipping."""
    lab = np.asarray(lab, dtype=np.float64).copy()
    lab[..., 0] = np.clip(lab[..., 0], 0.0, 1.0)
    lin = _oklab_to_linear(lab)
    if gamut_clip:
        bad = ((lin < -1e-4) | (lin > 1.0 + 1e-4)).any(axis=-1)
        if bad.any():
            lo = np.zeros(bad.sum())
            hi = np.ones(bad.sum())
            sub = lab[bad]
            for _ in range(14):
                mid = (lo + hi) / 2
                t = sub.copy()
                t[:, 1:] *= mid[:, None]
                ok = ~((_oklab_to_linear(t) < -1e-4) | (_oklab_to_linear(t) > 1 + 1e-4)).any(axis=-1)
                lo = np.where(ok, mid, lo)
                hi = np.where(ok, hi, mid)
            sub[:, 1:] *= lo[:, None]
            lab[bad] = sub
            lin = _oklab_to_linear(lab)
    return linear_to_srgb(lin)


def _in_gamut(lin, eps=1e-4):
    return ~((lin < -eps) | (lin > 1.0 + eps)).any(axis=-1)


def map_toward(lab_from, lab_to):
    """Return sRGB (0..1) of the point on the segment lab_from -> lab_to that is farthest
    along the way while still inside the sRGB gamut.

    Used instead of 'reduce chroma until it fits': when a bright, saturated colour (gold,
    yellow, emissive blocks) is nudged up in lightness, clipping chroma would wash it out to a
    pastel.  Walking back along the edit instead keeps the colour exactly as saturated as
    the original unless the edit itself asked for less."""
    lab_from = np.asarray(lab_from, dtype=np.float64)
    shape = np.shape(lab_to)
    lf = lab_from.reshape(-1, 3)
    lt = np.asarray(lab_to, dtype=np.float64).reshape(-1, 3).copy()
    lt[:, 0] = np.clip(lt[:, 0], 0.0, 1.0)
    bad = ~_in_gamut(_oklab_to_linear(lt))
    t = np.ones(len(lt))
    if bad.any():
        f, g = lf[bad], lt[bad]
        lo, hi = np.zeros(len(f)), np.ones(len(f))
        for _ in range(18):
            mid = (lo + hi) / 2
            ok = _in_gamut(_oklab_to_linear(f + (g - f) * mid[:, None]))
            lo, hi = np.where(ok, mid, lo), np.where(ok, hi, mid)
        t[bad] = lo
    res = lf + (lt - lf) * t[:, None]
    return linear_to_srgb(_oklab_to_linear(res)).reshape(shape)


def limit_delta(lab_from, lab_to, max_delta):
    """Cap the OKLab distance of an edit (keeps every texel recognisably the same colour)."""
    d = np.asarray(lab_to) - np.asarray(lab_from)
    n = np.sqrt((d ** 2).sum(axis=-1, keepdims=True))
    scale = np.minimum(1.0, max_delta / np.maximum(n, 1e-9))
    return np.asarray(lab_from) + d * scale


def hex_to_rgb(h: str):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64) / 255.0


def rgb_to_hex(rgb) -> str:
    v = np.clip(np.round(np.asarray(rgb) * 255), 0, 255).astype(int)
    return "#{:02X}{:02X}{:02X}".format(*v)


class Grade:
    """A pure colour -> colour function (so colormaps, overlay colours and
    carried textures all stay perfectly consistent with each other)."""

    def __init__(self, chroma=1.0, lightness=0.0, contrast=0.0, warm=0.0, lift=0.0):
        self.chroma, self.lightness, self.contrast, self.warm, self.lift = chroma, lightness, contrast, warm, lift

    def apply_rgb(self, rgb):
        rgb = np.asarray(rgb, dtype=np.float64)
        lab = rgb_to_oklab(rgb)
        L = lab[..., 0]
        # smooth S-curve around mid-grey (keeps black/white anchored)
        x = L - 0.5
        L2 = L + self.contrast * x * (1.0 - np.abs(2.0 * x)) * 2.0
        # lift: raise the very darkest tones slightly (more readable shadows) -- but never pure black,
        # which some textures use as "nothing" (additive layers, masks)
        not_black = smoothstep(0.0, 0.06, L)
        L2 = L2 + self.lift * (1.0 - L) ** 3 * not_black
        L2 = L2 + self.lightness * not_black
        out = np.empty_like(lab)
        out[..., 0] = L2
        # "vibrance": boost dull colours more than already-vivid ones, so nothing goes neon
        c = np.hypot(lab[..., 1], lab[..., 2])
        w = 1.0 - smoothstep(0.06, 0.24, c) * 0.9
        boost = 1.0 + (self.chroma - 1.0) * w
        out[..., 1] = lab[..., 1] * boost
        out[..., 2] = lab[..., 2] * boost
        # split-tone: warm highlights / cool shadows (tiny)
        if self.warm:
            # split-tone only on (near-)neutral texels: it should give grey stone / gravel a little
            # life, not push the hue of textures that already have a colour of their own
            neutral = (1.0 - smoothstep(0.03, 0.10, c)) * not_black
            hi = np.clip((L - 0.55) / 0.45, 0, 1)
            sh = np.clip((0.45 - L) / 0.45, 0, 1)
            out[..., 1] += neutral * self.warm * 0.010 * (hi - 0.6 * sh)
            out[..., 2] += neutral * self.warm * 0.022 * (hi - sh)
        return map_toward(lab, out)

    def apply_hex(self, h):
        return rgb_to_hex(self.apply_rgb(hex_to_rgb(h)))

    def apply_array(self, arr_u8):
        """arr_u8: (H,W,3|4) uint8. Alpha untouched."""
        a = arr_u8.astype(np.float64) / 255.0
        rgb = self.apply_rgb(a[..., :3])
        out = arr_u8.copy()
        out[..., :3] = np.clip(np.round(rgb * 255), 0, 255).astype(np.uint8)
        return out


# --------------------------------------------------------------------------
# noise (periodic => always tileable)
# --------------------------------------------------------------------------
def periodic_noise(h, w, beta=2.0, seed=0, kmin=0.0, kmax=None):
    """Isotropic 1/f^beta noise on a torus, normalised to 0..1."""
    rng = np.random.default_rng(seed)
    fy = np.fft.fftfreq(h)[:, None] * h
    fx = np.fft.fftfreq(w)[None, :] * w
    k = np.hypot(fx, fy)
    k[0, 0] = 1.0
    amp = 1.0 / (k ** (beta / 2.0))
    amp[0, 0] = 0.0
    if kmin:
        amp = np.where(k < kmin, 0.0, amp)
    if kmax:
        amp = np.where(k > kmax, 0.0, amp)
    spec = amp * (rng.normal(size=(h, w)) + 1j * rng.normal(size=(h, w)))
    f = np.fft.ifft2(spec).real
    f -= f.min()
    f /= max(f.max(), 1e-9)
    return f


def smoothstep(e0, e1, x):
    t = np.clip((np.asarray(x, dtype=np.float64) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


# --------------------------------------------------------------------------
# files
# --------------------------------------------------------------------------
def load_json_lenient(path):
    """Mojang's sample JSON contains // comments."""
    text = Path(path).read_text(encoding="utf-8")
    text = re.sub(r"^\s*//.*$", "", text, flags=re.M)
    return json.loads(text)


def write_json(path, obj, indent=2):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=indent, ensure_ascii=False) + "\n", encoding="utf-8")


def save_image(arr_or_img, path, tga_orientation=-1):
    """Save numpy (H,W,3|4) uint8 or PIL image. Format from extension; TGA kept
    as TGA so we never create a .png/.tga pair (the engine prefers .tga).
    tga_orientation: -1 => bottom-left origin (descriptor 0x08, Mojang's usual),
    1 => top-left origin (0x28, used by a couple of vanilla files)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    im = Image.fromarray(arr_or_img) if isinstance(arr_or_img, np.ndarray) else arr_or_img
    ext = path.suffix.lower()
    if ext == ".tga":
        im.convert("RGBA").save(path, format="TGA", orientation=tga_orientation)
    else:
        im.save(path, format="PNG", optimize=True)


def tga_orientation_of(path):
    """Read the origin bit of an existing TGA so a rewritten file matches it."""
    with open(path, "rb") as fh:
        hdr = fh.read(18)
    return 1 if hdr[17] & 0x20 else -1


def read_rgba(path):
    return np.array(Image.open(path).convert("RGBA"))


def env_vanilla(arg=None) -> Path:
    p = arg or os.environ.get("VANILLA_RP")
    if not p:
        raise SystemExit("Set VANILLA_RP or pass --vanilla <bedrock-samples>/resource_pack")
    p = Path(p)
    if not (p / "manifest.json").exists():
        raise SystemExit(f"{p} does not look like a resource pack")
    return p
