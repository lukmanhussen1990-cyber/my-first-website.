# Word-synced captions (1-3 words, pop-in per word) as ASS from the faster-whisper timestamps.
import json, sys, re
W=json.load(open('assets/words.json')); chunks=[]; cur=[]
for w in W:
    cur.append(w)
    if len(cur)==3 or re.search(r'[,.?!]$', w['w']): chunks.append(cur); cur=[]
if cur: chunks.append(cur)
def ts(x): return '%d:%02d:%05.2f'%(x//3600,(x%3600)//60,x%60)
out=['[Script Info]','ScriptType: v4.00+','PlayResX: 1080','PlayResY: 1920','WrapStyle: 2','',
'[V4+ Styles]','Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
'Style: Cap,Poppins ExtraBold,92,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,9,3,5,60,60,0,1',
'Style: WM,Poppins ExtraBold,34,&H80FFFFFF,&H80FFFFFF,&H80000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,0,3,30,36,40,1','',
'[Events]','Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
'Dialogue: 0,0:00:00.00,0:00:21.00,WM,,0,0,0,,[YOUR WATERMARK]']
for ci,ch in enumerate(chunks):
    end_chunk = chunks[ci+1][0]['s'] if ci+1<len(chunks) else ch[-1]['e']+0.4
    for i,w in enumerate(ch):
        s=w['s']; e=ch[i+1]['s'] if i+1<len(ch) else min(end_chunk, ch[-1]['e']+0.5)
        parts=[]
        for j,x in enumerate(ch):
            txt=re.sub(r'[,.]$','',x['w'])
            if j<i: parts.append(txt)
            elif j==i: parts.append(r'{\fscx70\fscy70\t(0,70,\fscx116\fscy116)\t(70,150,\fscx100\fscy100)}'+txt+r'{\fscx100\fscy100}')
            else: parts.append(r'{\alpha&HFF&}'+txt+r'{\alpha&H00&}')
        out.append('Dialogue: 1,%s,%s,Cap,,0,0,0,,{\\an5\\pos(540,960)}%s'%(ts(s),ts(e),' '.join(parts)))
open(sys.argv[1],'w').write('\n'.join(out)+'\n')
