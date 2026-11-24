"""Memory-aware full render of Episode 18: up to 2 Blender workers, but a shot only starts when there is enough free
RAM for it (heavy shots with many close-up characters need ~9 GB and effectively run alone).
Usage: python3 render_sched.py [samples] [shot ...]      (log lines: OK <shot> <frames> secs=<s> | FAIL <shot>)"""
import os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cuts  # noqa: E402

B = os.environ.get("B", "/opt/blender-4.5.16-linux-x64/blender")
S = os.environ.get("LARRY_WORK", os.path.expanduser("~/larry_work"))
OUT = os.path.join(S, "ep18", "frames")
SPP = sys.argv[1] if len(sys.argv) > 1 else "4"
SHOTS = sys.argv[2:] or cuts.SHOT_NAMES
# GB of RAM a shot needs while rendering (measured: 6 subdivided characters ~8.5 GB, 2-3 characters ~4-5 GB)
# (no render subdivision outside close-ups: ~40% less than the first estimate)
HEAVY = {s: 6.0 for s in ("sh04", "sh05", "sh06", "sh07", "sh08", "sh09", "sh10", "sh12", "sh13", "sh15", "sh18")}   # the full dinner table
NEED = {s: HEAVY.get(s, 4.2) for s in SHOTS}
os.makedirs(os.path.join(OUT, "logs"), exist_ok=True)


def avail_gb():
    with open("/proc/meminfo") as f:
        for line in f:
            if line.startswith("MemAvailable:"):
                return int(line.split()[1]) / 1048576
    return 0.0


queue = sorted(SHOTS, key=lambda s: -NEED[s])        # big ones first, small ones fill the gaps
running = {}
while queue or running:
    for sh, (p, t0) in list(running.items()):
        if p.poll() is not None:
            log = open(os.path.join(OUT, "logs", f"{sh}.log")).read()
            if "SHOT_DONE" in log:
                print(f"OK {sh} {cuts.frames_of(sh)} secs={time.time() - t0:.1f}", flush=True)
            else:
                print(f"FAIL {sh}", flush=True)
            del running[sh]
    started = False
    for sh in list(queue):
        if len(running) >= 2:
            break
        need = NEED[sh] + (1.0 if running else 0.0)
        if avail_gb() >= need or not running:
            fr = os.path.join(OUT, sh)
            done = len([f for f in os.listdir(fr) if f.endswith(".png")]) if os.path.isdir(fr) else 0
            if done >= cuts.frames_of(sh):
                print(f"OK {sh} {cuts.frames_of(sh)} secs=0 (already rendered)", flush=True)
                queue.remove(sh); continue
            args = ["xvfb-run", "-a", "-s", "-screen 0 1280x1024x24", B, "-b", "--python",
                    os.path.join(HERE, "render_shot.py"), "--", sh, OUT, os.environ.get("MODE", "full"), SPP]
            if done:
                args += [str(done + 1), str(cuts.frames_of(sh))]       # resume a partly rendered shot
            p = subprocess.Popen(args, cwd="/tmp", stdout=open(os.path.join(OUT, "logs", f"{sh}.log"), "w"),
                                 stderr=subprocess.STDOUT)
            running[sh] = (p, time.time()); queue.remove(sh); started = True
            time.sleep(60)                                   # let it load before measuring memory again
            break
    if not started:
        time.sleep(15)
print("ALL_DONE", flush=True)
