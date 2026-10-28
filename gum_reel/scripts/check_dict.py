import os, pocketsphinx
d = os.path.join(os.path.dirname(pocketsphinx.__file__), 'model/en-us/cmudict-en-us.dict')
words = set(l.split()[0] for l in open(d))
script = open('/home/user/work/scripts/script.txt').read().lower()
import re
toks = re.findall(r"[a-z']+", script)
print(len(toks), [t for t in toks if t not in words])
