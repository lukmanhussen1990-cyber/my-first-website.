"""Resumable render queue. Usage: python renderq.py WORKER_ID SHOT[,SHOT...]  (order = priority)
Each worker claims chunks via atomic mkdir locks in /opt/work/q and renders missing frames."""
import os, sys, subprocess, time
LEN = {"S01a": 28, "S01b": 35, "S02": 63, "S03": 64, "S04a": 23, "S04b": 44, "S05": 64, "S06": 21, "S07a": 27,
       "S07b": 26, "S08a": 44, "S08b": 13, "S09": 69, "S10": 28, "S11": 60, "S12a": 29, "S12b": 33, "S13a": 45,
       "S13b": 30}
CH = 30
wid = sys.argv[1]
shots = sys.argv[2].split(",")
mode = sys.argv[3] if len(sys.argv) > 3 else "final"
Q = f"/opt/work/bc/q_{mode}"
os.makedirs(Q, exist_ok=True)
SCRIPTS = "/home/user/my-first-website./bouncy-castle-reel/scripts"
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
        outdir = f"/opt/work/bc/renders/{mode}/{shot}"
        missing = [f for f in range(a, b + 1) if not os.path.exists(f"{outdir}/{f:04d}.png")]
        if not missing:
            open(f"{lock}/done", "w").write("skip")
            continue
        t = time.time()
        cmd = ["blender", "-b", "/opt/work/bc/master.blend", "--python", f"{SCRIPTS}/render_shot.py", "--",
               shot, mode, str(min(missing)), str(max(missing)), "/opt/work/bc/renders"]
        r = subprocess.run(cmd, capture_output=True, text=True)
        ok = "SHOT_DONE" in r.stdout
        open(f"{lock}/done", "w").write(f"{'ok' if ok else 'FAIL'} {time.time()-t:.0f}s\n" + ("" if ok else r.stdout[-3000:] + r.stderr[-2000:]))
        print(f"[w{wid}] {shot} {a}-{b} {'ok' if ok else 'FAIL'} {time.time()-t:.0f}s", flush=True)
print(f"[w{wid}] QUEUE_EMPTY", flush=True)
