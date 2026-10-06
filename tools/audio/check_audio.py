#!/usr/bin/env python3
"""Verify the custom sound set of Parasite Apocalypse Survival.

Checks every .ogg under addon/resource_pack/sounds/pas/ by decoding it with
ffprobe/ffmpeg (codec vorbis, 1 channel, 44100 Hz, duration bounds, peak,
RMS, DC offset, NaN/Inf, click-free ends) and validates the two fragments:

* addon/fragments/sound_definitions/pas.json
    - matches catalog.py (regenerate with synth.py if stale)
    - every ids.js SOUNDS id is defined
    - only vanilla categories and vanilla-used definition/entry fields
    - every "sounds/pas/..." name exists, no unreferenced .ogg files
    - every vanilla path (e.g. sounds/mob/cow/say1) exists in the vanilla RP
* addon/fragments/sounds/pas.json
    - entity_sounds.entities has exactly the 7 ids.js ENTITIES
    - event names are ones vanilla sounds.json uses
    - every referenced sound id is ours or a vanilla definition

Vanilla reference: $PAS_VANILLA_REF or the bedrock-samples 1.21.0.26 path from
docs/SPEC.md; vanilla checks are skipped (with a message) if it is missing.

Usage:
  python3 tools/audio/check_audio.py [--sheet spectrograms.png]
Exit code 0 = all good.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True  # keep tools/audio free of __pycache__
sys.path.insert(0, str(Path(__file__).resolve().parent))
import catalog  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SOUND_DIR = ROOT / "addon" / "resource_pack" / "sounds" / "pas"
FRAG_DEFS = ROOT / "addon" / "fragments" / "sound_definitions" / "pas.json"
FRAG_SOUNDS = ROOT / "addon" / "fragments" / "sounds" / "pas.json"
IDS_JS = ROOT / "addon" / "behavior_pack" / "scripts" / "lib" / "ids.js"
DEFAULT_REF = ("/tmp/claude-0/-home-user-my-first-website-/6f33ccbb-4073-57f5-b83c-87aab56fa441"
               "/scratchpad/ref/bedrock-samples-1.21.0.26")
SR = catalog.SAMPLE_RATE

ALLOWED_DEF_FIELDS = {"category", "min_distance", "max_distance", "sounds", "volume", "pitch", "subtitle",
                      "__use_legacy_max_distance"}
ALLOWED_ENTRY_FIELDS = {"name", "volume", "pitch", "weight", "is3D", "stream", "load_on_low_memory"}

errors: list[str] = []
warnings: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def ref_root() -> Path | None:
    p = Path(os.environ.get("PAS_VANILLA_REF", DEFAULT_REF))
    return p if (p / "resource_pack").is_dir() else None


# ----------------------------------------------------------------- audio
def probe(path: Path) -> dict:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def decode(path: Path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-acodec", "pcm_f32le",
                          "-ac", "1", "-ar", str(SR), "pipe:1"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype="<f4").astype(np.float64)


def db(x: float) -> float:
    return 20.0 * np.log10(max(x, 1e-12))


def check_file(path: Path, dur_bounds: tuple[float, float]) -> dict:
    rel = path.relative_to(ROOT)
    info = probe(path)
    streams = [s for s in info.get("streams", []) if s.get("codec_type") == "audio"]
    if len(streams) != 1:
        err(f"{rel}: expected 1 audio stream, got {len(streams)}")
        return {}
    st = streams[0]
    if st.get("codec_name") != "vorbis":
        err(f"{rel}: codec {st.get('codec_name')} != vorbis")
    if int(st.get("channels", 0)) != 1:
        err(f"{rel}: channels {st.get('channels')} != 1")
    if int(st.get("sample_rate", 0)) != SR:
        err(f"{rel}: sample_rate {st.get('sample_rate')} != {SR}")
    x = decode(path)
    dur = x.size / SR
    stats = {"file": str(rel), "dur": dur}
    if not np.all(np.isfinite(x)):
        err(f"{rel}: NaN/Inf samples")
        return stats
    lo, hi = dur_bounds
    if not (lo <= dur <= hi):
        err(f"{rel}: duration {dur:.3f}s outside [{lo}, {hi}]")
    peak = float(np.max(np.abs(x)))
    rms = float(np.sqrt(np.mean(x ** 2)))
    dc = float(np.mean(x))
    stats.update(peak_db=db(peak), rms_db=db(rms), dc=dc)
    if not (-2.5 <= db(peak) <= 0.0):
        err(f"{rel}: peak {db(peak):.2f} dBFS not about -1 dBFS")
    if db(rms) < -40.0:
        err(f"{rel}: RMS {db(rms):.1f} dBFS too quiet")
    if abs(dc) > 0.005:
        err(f"{rel}: DC offset {dc:.4f}")
    edge = max(abs(x[0]), abs(x[-1]))
    if edge > 0.02:
        err(f"{rel}: non-zero start/end sample ({edge:.3f}) - missing fade")
    return stats


def check_audio() -> list[dict]:
    rows = []
    expected = set()
    for spec in catalog.SOUNDS:
        for stem in catalog.file_stems(spec):
            p = ROOT / "addon" / "resource_pack" / (stem + ".ogg")
            expected.add(p)
            if not p.is_file():
                err(f"missing {p.relative_to(ROOT)}")
                continue
            r = check_file(p, spec["dur"])
            r["id"] = spec["id"]
            rows.append(r)
    for p in SOUND_DIR.rglob("*"):
        if p.is_file() and p not in expected:
            err(f"unreferenced file {p.relative_to(ROOT)}")
    return rows


# ----------------------------------------------------------------- fragments
def ids_js_values(block: str) -> list[str]:
    src = IDS_JS.read_text(encoding="utf-8")
    m = re.search(r"export const " + block + r"\s*=\s*Object\.freeze\(\{(.*?)\}\)", src, re.S)
    if not m:
        err(f"ids.js: {block} not found")
        return []
    body = m.group(1)
    vals = re.findall(r':\s*"([^"]+)"', body)
    # ENTITIES in ids.js are literal strings; resolve nothing else
    return vals


def vanilla_audio_exists(ref: Path, stem: str) -> bool:
    base = ref / "resource_pack" / stem
    return any(base.with_suffix(ext).is_file() for ext in (".ogg", ".fsb", ".wav"))


def check_fragments() -> None:
    ref = ref_root()
    try:
        defs = json.loads(FRAG_DEFS.read_text(encoding="utf-8"))
        snd = json.loads(FRAG_SOUNDS.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        err(f"cannot read fragments: {e}")
        return
    if defs != catalog.build_sound_definitions():
        err(f"{FRAG_DEFS.relative_to(ROOT)} is stale - run tools/audio/synth.py --defs-only")
    if snd != catalog.build_entity_sounds():
        err(f"{FRAG_SOUNDS.relative_to(ROOT)} is stale - run tools/audio/synth.py --defs-only")

    vdefs: dict = {}
    vsounds: dict = {}
    if ref:
        vdefs = json.loads((ref / "resource_pack/sounds/sound_definitions.json").read_text())["sound_definitions"]
        vsounds = json.loads((ref / "resource_pack/sounds.json").read_text())
    else:
        warnings.append("vanilla reference not found: vanilla cross-checks skipped")

    vcats = {v.get("category") for v in vdefs.values() if isinstance(v, dict)} - {None} or catalog.VANILLA_CATEGORIES
    for sid in ids_js_values("SOUNDS"):
        if sid not in defs:
            err(f"ids.js sound {sid} not defined in sound_definitions fragment")
    for sid, d in defs.items():
        if not sid.startswith("pas."):
            err(f"{sid}: sound ids must use the pas. prefix")
        if sid in vdefs:
            err(f"{sid}: collides with a vanilla sound id")
        extra = set(d) - ALLOWED_DEF_FIELDS
        if extra:
            err(f"{sid}: unknown definition fields {sorted(extra)}")
        if d.get("category") not in vcats:
            err(f"{sid}: category {d.get('category')} not used by vanilla")
        if not d.get("sounds"):
            err(f"{sid}: empty sounds list")
        if not any(isinstance(e, dict) and e.get("load_on_low_memory") for e in d.get("sounds", [])):
            warnings.append(f"{sid}: no load_on_low_memory entry")
        for e in d.get("sounds", []):
            if not isinstance(e, dict):
                err(f"{sid}: entries must be objects")
                continue
            extra = set(e) - ALLOWED_ENTRY_FIELDS
            if extra:
                err(f"{sid}: unknown entry fields {sorted(extra)}")
            name = e.get("name", "")
            if name.startswith("sounds/pas/"):
                if not (ROOT / "addon" / "resource_pack" / (name + ".ogg")).is_file():
                    err(f"{sid}: missing file for {name}")
            elif name.startswith("sounds/"):
                if ref and not vanilla_audio_exists(ref, name):
                    err(f"{sid}: vanilla file {name} not found in reference RP")
            else:
                err(f"{sid}: bad sound name {name!r}")
            for key in ("volume", "pitch"):
                if key in e and not (0.0 < float(e[key]) <= 4.0):
                    err(f"{sid}: {key} out of range")

    # sounds.json fragment
    ents = snd.get("entity_sounds", {}).get("entities", {})
    if set(snd) != {"entity_sounds"} or set(snd.get("entity_sounds", {})) != {"entities"}:
        err("sounds fragment must only contain entity_sounds.entities")
    want = set(ids_js_values("ENTITIES"))
    if set(ents) != want:
        err(f"entity_sounds entities {sorted(ents)} != ids.js ENTITIES {sorted(want)}")
    vevents = set()
    for v in vsounds.get("entity_sounds", {}).get("entities", {}).values():
        vevents |= set(v.get("events", {}))
    vevents |= set(vsounds.get("entity_sounds", {}).get("defaults", {}).get("events", {}))
    for eid, cfg in ents.items():
        if set(cfg) - {"volume", "pitch", "events"}:
            err(f"{eid}: unknown keys {sorted(set(cfg) - {'volume', 'pitch', 'events'})}")
        for ev, val in cfg.get("events", {}).items():
            if vevents and ev not in vevents:
                err(f"{eid}: event {ev!r} is not a vanilla entity sound event")
            sid = val if isinstance(val, str) else val.get("sound")
            if sid not in defs and not (sid in vdefs):
                err(f"{eid}.{ev}: sound {sid!r} not defined (ours or vanilla)")
            if not isinstance(val, str) and set(val) - {"sound", "volume", "pitch"}:
                err(f"{eid}.{ev}: unknown keys")


# ----------------------------------------------------------------- contact sheet
_CMAP = np.array([[0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99], [212, 72, 66],
                  [245, 125, 21], [250, 193, 39], [252, 255, 164]], dtype=np.float64)


def colormap(v: np.ndarray) -> np.ndarray:
    v = np.clip(v, 0.0, 1.0) * (len(_CMAP) - 1)
    i = np.minimum(np.floor(v).astype(int), len(_CMAP) - 2)
    f = (v - i)[..., None]
    return (_CMAP[i] * (1 - f) + _CMAP[i + 1] * f).astype(np.uint8)


def spectrogram_img(x: np.ndarray, w: int, h: int) -> np.ndarray:
    nfft, hop = 1024, 128
    pad = np.concatenate([np.zeros(nfft // 2), x, np.zeros(nfft)])
    frames = 1 + (pad.size - nfft) // hop
    idx = np.arange(nfft)[None, :] + hop * np.arange(frames)[:, None]
    spec = np.abs(np.fft.rfft(pad[idx] * np.hanning(nfft), axis=1))
    sdb = 20 * np.log10(spec / (np.max(spec) + 1e-12) + 1e-9)
    freqs = np.fft.rfftfreq(nfft, 1 / SR)
    rows = np.geomspace(20000, 40, h)  # log frequency, top = high
    ri = np.clip(np.searchsorted(freqs, rows), 0, freqs.size - 1)
    ci = np.clip((np.arange(w) * frames / w).astype(int), 0, frames - 1)
    img = sdb[ci][:, ri].T
    return colormap((img + 85.0) / 85.0)


def contact_sheet(rows: list[dict], out: Path) -> None:
    from PIL import Image, ImageDraw
    tw, th, wh, lab = 300, 130, 34, 16
    cols = 5
    cell_h = lab + th + wh + 8
    nrows = (len(rows) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tw + 8) + 8, nrows * cell_h + 8), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    for k, r in enumerate(rows):
        x = decode(ROOT / r["file"])
        cx = 8 + (k % cols) * (tw + 8)
        cy = 8 + (k // cols) * cell_h
        name = Path(r["file"]).relative_to("addon/resource_pack/sounds/pas").as_posix()
        d.text((cx, cy), f"{name}  {r['dur']:.2f}s  {r['rms_db']:.0f}dB", fill=(230, 230, 230))
        sheet.paste(Image.fromarray(spectrogram_img(x, tw, th)), (cx, cy + lab))
        # waveform envelope strip
        wy = cy + lab + th + 2
        d.rectangle([cx, wy, cx + tw - 1, wy + wh - 1], fill=(14, 14, 18))
        seg = np.array_split(np.abs(x), tw)
        for i, s in enumerate(seg):
            a = float(np.max(s)) if s.size else 0.0
            hh = int(a * (wh / 2 - 1))
            d.line([cx + i, wy + wh // 2 - hh, cx + i, wy + wh // 2 + hh], fill=(120, 200, 140))
        # 100 Hz / 1 kHz / 10 kHz guide ticks
        for f in (100, 1000, 10000):
            fy = cy + lab + int(th * np.log(20000 / f) / np.log(20000 / 40))
            d.line([cx, fy, cx + 5, fy], fill=(255, 255, 255))
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print(f"contact sheet: {out}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sheet", type=Path, help="write a spectrogram contact sheet PNG here")
    ap.add_argument("-v", "--verbose", action="store_true", help="print per-file stats")
    args = ap.parse_args()
    rows = check_audio()
    check_fragments()
    if args.verbose:
        for r in rows:
            if "peak_db" in r:
                print(f"  {r['file'][len('addon/resource_pack/'):]:40s} {r['dur']:5.2f}s "
                      f"peak {r['peak_db']:6.2f} dBFS  rms {r['rms_db']:6.1f} dBFS  dc {r['dc']:+.5f}")
    if args.sheet:
        contact_sheet([r for r in rows if "rms_db" in r], args.sheet)
    for w in warnings:
        print("WARN:", w)
    for e in errors:
        print("ERROR:", e)
    n_ids = len(json.loads(FRAG_DEFS.read_text())) if FRAG_DEFS.is_file() else 0
    print(f"checked {len(rows)} ogg files, {n_ids} sound ids: "
          f"{'OK' if not errors else str(len(errors)) + ' error(s)'}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
