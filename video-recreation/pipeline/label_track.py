import json, numpy as np, os
S = os.environ.get("WORKDIR", os.path.abspath("./work"))
lab = json.load(open(S + "/track_raw.json"))
anc = json.load(open(S + "/track_anchor.json"))
son = json.load(open(S + "/track_sonnet.json"))

# label-template origin relative to the anchor template, in UI units (scale 1)
D = []
for i in range(53, 89):
    L, A = lab[str(i)], anc[str(i)]
    if L["score"] > 0.85 and A["score"] > 0.85:
        s = A["scale"]
        D.append(((L["x"] - A["x"]) / s, (L["y"] - A["y"]) / s))
D = np.array(D)
DX, DY = float(np.median(D[:, 0])), float(np.median(D[:, 1]))
print("anchor->label offset (UI units):", round(DX, 2), round(DY, 2), "n=", len(D))

track = {}
# 48-52: from the "sonnet"-only tracker (label is clipped by the right frame edge here)
for i in range(48, 53):
    t = son[str(i)]
    s = t["scale"]
    track[i] = {"x": t["x"] + 2.0 * s, "y": t["y"] + 2.0 * s, "scale": s, "src": "sonnet"}
# 53-88: direct label tracker
for i in range(53, 89):
    t = lab[str(i)]
    track[i] = {"x": float(t["x"]), "y": float(t["y"]), "scale": t["scale"], "src": "label"}
# 89-137: anchor tracker + rigid offset (label is off/partly off the right frame edge)
for i in range(89, 138):
    a = anc[str(i)]
    s = a["scale"]
    track[i] = {"x": a["x"] + DX * s, "y": a["y"] + DY * s, "scale": s, "src": "anchor"}
# 138-179: direct label tracker again
for i in range(138, 180):
    t = lab[str(i)]
    track[i] = {"x": float(t["x"]), "y": float(t["y"]), "scale": t["scale"], "src": "label"}

# light temporal smoothing within continuous shots (cuts at 89/90 and 137/138)
segs = [(48, 89), (90, 137), (138, 179)]
sm = {}
for a, b in segs:
    idx = list(range(a, b + 1))
    for key in ("x", "y", "scale"):
        v = np.array([track[i][key] for i in idx], float)
        k = np.array([0.25, 0.5, 0.25])
        vp = np.pad(v, 1, mode="edge")
        v2 = np.convolve(vp, k, mode="valid")
        for j, i in enumerate(idx):
            sm.setdefault(i, {})[key] = float(v2[j])
for i in sm:
    sm[i]["src"] = track[i]["src"]

json.dump(sm, open(S + "/label_track.json", "w"), indent=1)
for i in sorted(sm):
    print(i, round(sm[i]["x"], 1), round(sm[i]["y"], 1), round(sm[i]["scale"], 3), sm[i]["src"])
