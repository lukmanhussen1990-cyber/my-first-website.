import sys, wave, json, re, os
from pocketsphinx import Decoder, get_model_path
text = open(sys.argv[2]).read()
words = re.findall(r"[a-z']+", text.lower().replace('’',"'"))
mp = get_model_path()
dic = open(os.path.join(mp,'en-us','cmudict-en-us.dict')).read()
have = set(l.split()[0] for l in dic.splitlines() if l)
missing = sorted(set(w for w in words if w not in have))
print('missing from dict:', missing, file=sys.stderr)
d = Decoder(samprate=16000, bestpath=False)
extra = {'gavest':'G EY V AH S T','thereof':'DH EH R AH V','beguiled':'B IH G AY L D','hath':'HH AE TH'}
for w in missing:
    if w in extra: d.add_word(w, extra[w], True)
w = wave.open(sys.argv[1],'rb'); data = w.readframes(w.getnframes())
d.set_align_text(' '.join(words))
d.start_utt(); d.process_raw(data, full_utt=True); d.end_utt()
out=[]
for seg in d.seg():
    out.append(dict(w=seg.word, s=round(seg.start_frame*0.01,3), e=round((seg.end_frame+1)*0.01,3)))
json.dump(out, open(sys.argv[3],'w'), indent=0)
print('segments', len(out), 'words', len(words), file=sys.stderr)
