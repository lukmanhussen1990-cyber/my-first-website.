import json, os, sys, urllib.request, concurrent.futures as cf
OUT="/opt/work/assets/polyhaven"
def get(url):
    req=urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) asset-fetch/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r: return r.read()
def dl_asset(aid, kind, res="1k", fmt="blend"):
    info=json.loads(get(f"https://api.polyhaven.com/files/{aid}"))
    jobs=[]
    d=os.path.join(OUT,aid); os.makedirs(d,exist_ok=True)
    if kind=="hdri":
        e=info["hdri"][res]["exr"]; jobs.append((e["url"], os.path.join(d, f"{aid}_{res}.exr")))
    elif kind=="model":
        b=info[fmt][res][fmt]; jobs.append((b["url"], os.path.join(d, os.path.basename(b["url"]))))
        for rel,inc in b.get("include",{}).items(): jobs.append((inc["url"], os.path.join(d, rel)))
    elif kind=="texture":
        for m in ["Diffuse","nor_gl","Rough","AO","arm","Displacement"]:
            if m in info and res in info[m]:
                fm = "jpg" if "jpg" in info[m][res] else list(info[m][res].keys())[0]
                u=info[m][res][fm]["url"]; jobs.append((u, os.path.join(d, os.path.basename(u))))
    for u,p in jobs:
        os.makedirs(os.path.dirname(p),exist_ok=True)
        if not os.path.exists(p):
            open(p,"wb").write(get(u))
    return aid, len(jobs)
assets=[a.split(":") for a in sys.argv[1:]]
with cf.ThreadPoolExecutor(4) as ex:
    for r in ex.map(lambda a: dl_asset(a[0], a[1], *(a[2:] if len(a)>2 else [])), assets):
        print("done", r, flush=True)
