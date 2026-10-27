import asyncio, sys, json, ssl, os
# optional: a copy of edge_tts patched to request audio-24khz-96kbitrate-mono-mp3 (see README)
if os.environ.get('EDGE_TTS_PATH'):
    sys.path.insert(0, os.environ['EDGE_TTS_PATH'])
import edge_tts, edge_tts.communicate as _ec
if os.environ.get('TTS_CA_BUNDLE'):
    _ec._SSL_CTX = ssl.create_default_context(cafile=os.environ['TTS_CA_BUNDLE'])
PROXY = os.environ.get('TTS_PROXY') or None
sys.path.insert(0, os.path.dirname(__file__))
from script_data import SEGMENTS, plain
VOICE = sys.argv[1] if len(sys.argv)>1 else 'en-US-AndrewNeural'
RATE = sys.argv[2] if len(sys.argv)>2 else '-8%'
OUT = sys.argv[3] if len(sys.argv)>3 else os.path.join(os.path.dirname(__file__),'vo')
only = sys.argv[4].split(',') if len(sys.argv)>4 else None
os.makedirs(OUT, exist_ok=True)
async def one(sid, text):
    for attempt in range(4):
        try:
            c = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary", proxy=PROXY)
            words=[]; audio=b''
            async for ch in c.stream():
                if ch['type']=='audio': audio+=ch['data']
                elif ch['type']=='WordBoundary': words.append({'t':ch['offset']/1e7,'d':ch['duration']/1e7,'w':ch['text']})
            open(f'{OUT}/{sid}.mp3','wb').write(audio)
            json.dump({'text':text,'words':words}, open(f'{OUT}/{sid}.json','w'), indent=1)
            return words
        except Exception as e:
            print('retry', sid, e); await asyncio.sleep(2**attempt)
async def main():
    for sid, scene, markup in SEGMENTS:
        if only and sid not in only: continue
        text = plain(markup)
        w = await one(sid, text)
        print(sid, f"{w[-1]['t']+w[-1]['d']:.2f}s", ' '.join(x['w'] for x in w))
asyncio.run(main())
