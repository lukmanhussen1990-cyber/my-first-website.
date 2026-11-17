"""Resumable render queue. Usage: python renderq.py WORKER_ID SHOT[,SHOT...]  (order = priority)
Each worker claims chunks via atomic mkdir locks in /opt/work/q and renders missing frames."""
import os, sys, subprocess, time
LEN = {"S01a": 29, "S01b": 31, "S02": 54, "S03": 56, "S04a": 33, "S04b": 19, "S05": 57, "S06": 26, "S07a": 36,
       "S07b": 28, "S07c": 24, "S08": 83, "S09": 33, "S10": 51, "S11a": 34, "S11b": 26, "S11c": 19, "S12": 63,
       "S13a": 35, "S13b": 39, "S14": 109}
CH = 30
wid = sys.argv[1]
shots = sys.argv[2].split(",")
mode = sys.argv[3] if len(sys.argv) > 3 else "final"
Q = f"/opt/work/q_{mode}"
os.makedirs(Q, exist_ok=True)
SCRIPTS = "/home/user/my-first-website./dunk-tank-reel/scripts"
for shot in shots:
    n = LEN[shot]
    k = max(1, round(n / CH))
    size = -(-n // k)
    for a in range(1, n + 1, size):
        b = min(n, a + size - 1)
        lock = f"{Q}/{shot}_{a:03d}"
        try:
            os.mkdir(lock)
        except FileExistsError:
            continue
        outdir = f"/opt/work/renders/{mode}/{shot}"
        missing = [f for f in range(a, b + 1) if not os.path.exists(f"{outdir}/{f:04d}.png")]
        if not missing:
            open(f"{lock}/done", "w").write("skip")
            continue
        t = time.time()
        cmd = ["blender", "-b", "/opt/work/master.blend", "--python", f"{SCRIPTS}/render_shot.py", "--",
               shot, mode, str(min(missing)), str(max(missing)), "/opt/work/renders"]
        r = subprocess.run(cmd, capture_output=True, text=True)
        ok = "SHOT_DONE" in r.stdout
        open(f"{lock}/done", "w").write(f"{'ok' if ok else 'FAIL'} {time.time()-t:.0f}s\n" + ("" if ok else r.stdout[-3000:] + r.stderr[-2000:]))
        print(f"[w{wid}] {shot} {a}-{b} {'ok' if ok else 'FAIL'} {time.time()-t:.0f}s", flush=True)
print(f"[w{wid}] QUEUE_EMPTY", flush=True)
