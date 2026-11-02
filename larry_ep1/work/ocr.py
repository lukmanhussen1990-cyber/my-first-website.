import subprocess, glob, os, sys
from concurrent.futures import ThreadPoolExecutor
os.environ['OMP_THREAD_LIMIT']='1'
os.chdir(sys.argv[1])
files = sorted(glob.glob('ocr/*.png'))
def run(f):
    t = subprocess.run(['tesseract', f, '-', '--psm', '6'], capture_output=True, text=True, env=os.environ).stdout
    return (int(os.path.basename(f)[2:6])-1)*0.25, ' '.join(t.split())
with ThreadPoolExecutor(4) as ex: res = list(ex.map(run, files))
with open('ocr_raw.txt','w') as fo:
    for t, s in res: fo.write(f"{t:6.2f} {s}\n")
prev=None; out=[]
for t,s in res:
    if s!=prev: out.append(f"{t:6.2f} {s}"); prev=s
open('ocr_changes.txt','w').write('\n'.join(out))
