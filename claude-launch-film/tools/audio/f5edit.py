import os, sys, json, torch, numpy as np, soundfile as sf, soxr, torch.nn.functional as F
torch.set_num_threads(int(os.environ.get('NT','3')))
from importlib.resources import files
from hydra.utils import get_class
from omegaconf import OmegaConf
from f5_tts.infer.utils_infer import load_checkpoint, load_vocoder
from f5_tts.model import CFM
from f5_tts.model.utils import get_tokenizer
exp="F5TTS_v1_Base"
cfg=OmegaConf.load(str(files("f5_tts").joinpath(f"configs/{exp}.yaml")))
cls=get_class(f"f5_tts.model.{cfg.model.backbone}"); arc=cfg.model.arch; ms=cfg.model.mel_spec
SR=ms.target_sample_rate; HOP=ms.hop_length
vocoder=load_vocoder(vocoder_name=ms.mel_spec_type, is_local=False)
vmap,vsize=get_tokenizer("/root/.cache/huggingface/hub/models--SWivid--F5-TTS/snapshots/84e5a410d9cead4de2f847e7c9369a6440bdfaca/F5TTS_v1_Base/vocab.txt","custom")
model=CFM(transformer=cls(**arc,text_num_embeds=vsize,mel_dim=ms.n_mel_channels),
  mel_spec_kwargs=dict(n_fft=ms.n_fft,hop_length=HOP,win_length=ms.win_length,n_mel_channels=ms.n_mel_channels,target_sample_rate=SR,mel_spec_type=ms.mel_spec_type),
  odeint_kwargs=dict(method="euler"),vocab_char_map=vmap)
ckpt="/root/.cache/huggingface/hub/models--SWivid--F5-TTS/snapshots/84e5a410d9cead4de2f847e7c9369a6440bdfaca/F5TTS_v1_Base/model_1250000.safetensors"
model=load_checkpoint(model,ckpt,"cpu",use_ema=True)
v,sr=sf.read('vocals_htdemucs_ft.wav',dtype='float32'); v=v.mean(1)
jobs=json.load(open(sys.argv[1]))
os.makedirs('gen',exist_ok=True)
for j in jobs:
    out=f"gen/{j['name']}.wav"
    if os.path.exists(out): continue
    a,b=j['clip']; s,e=j['span']; dur=j.get('dur',e-s)
    x=soxr.resample(v[int(a*sr):int(b*sr)],sr,SR).astype(np.float32)
    audio=torch.from_numpy(x)[None]
    rms=audio.pow(2).mean().sqrt().item(); g=0.1/rms if rms<0.1 else 1.0
    audio=audio*g
    with torch.inference_mode():
        mel=model.mel_spec(audio).permute(0,2,1)
    sf_=round((s-a)*SR/HOP); ef=round((e-a)*SR/HOP); df=round(dur*SR/HOP)
    cond=torch.cat([mel[:,:sf_],torch.zeros(1,df,mel.shape[2]),mel[:,ef:]],1)
    mask=torch.cat([torch.ones(1,sf_,dtype=torch.bool),torch.zeros(1,df,dtype=torch.bool),torch.ones(1,mel.shape[1]-ef,dtype=torch.bool)],1)
    with torch.inference_mode():
        gen,_=model.sample(cond=cond,text=[j['text']],duration=cond.shape[1],steps=j.get('nfe',32),cfg_strength=j.get('cfg',2.0),
            sway_sampling_coef=-1.0,seed=j['seed'],edit_mask=mask)
        wav=vocoder.decode(gen.float().permute(0,2,1)).cpu()[0].numpy()/g
    sf.write(out,wav,SR,subtype='FLOAT')
    json.dump(dict(j,start_frame=sf_,dur_frames=df,hop=HOP,sr=SR),open(out.replace('.wav','.json'),'w'))
    print('done',j['name'],flush=True)
