"""Dump the phone camera track (per-frame position, rotation, lens) for post-production.

blender -b --factory-startup -P export_camera.py -- OUT.json
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
import cameras  # noqa: E402

out = sys.argv[sys.argv.index("--") + 1]
track = cameras.phone_track()
json.dump([{"p": list(p), "q": list(q), "lens": lens} for p, q, lens in track], open(out, "w"))
print("wrote", out, len(track))
