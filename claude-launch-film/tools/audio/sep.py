import torch, soundfile as sf, numpy as np, sys
torch.set_num_threads(3)
from demucs.pretrained import get_model
from demucs.apply import apply_model
name=sys.argv[1]
m=get_model(name); m=m.models[3] if hasattr(m,'models') else m; m.eval()
x,sr=sf.read('../src/ref_audio.wav',dtype='float32'); assert sr==44100
wav=torch.from_numpy(x.T.copy())
ref=wav.mean(0); 
with torch.no_grad():
    out=apply_model(m,wav[None],shifts=2,split=True,overlap=0.5,progress=True)[0]
srcs=m.sources; print(srcs)
v=out[srcs.index('vocals')].numpy().T
acc=(wav.numpy().T - v)
sf.write(f'vocals_{name}.wav',v,sr,subtype='FLOAT'); sf.write(f'accomp_{name}.wav',acc,sr,subtype='FLOAT')
print('done')
