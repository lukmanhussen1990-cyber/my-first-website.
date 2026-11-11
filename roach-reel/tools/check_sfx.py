import subprocess, sys, numpy as np
from faster_whisper import WhisperModel
m = WhisperModel("large-v3", device="cpu", compute_type="int8", cpu_threads=4)
for f in sys.argv[1:]:
    pcm = subprocess.run(["ffmpeg","-v","error","-i",f,"-f","f32le","-ac","1","-ar","16000","-"],capture_output=True,check=True).stdout
    a = np.frombuffer(pcm, dtype=np.float32)
    segs, _ = m.transcribe(a, language="en", word_timestamps=True, vad_filter=False)
    out = []
    for s in segs:
        for w in s.words: out.append(f"{w.word.strip()}@{w.start:.2f}-{w.end:.2f}")
    # spectral centroid of loud part
    sp = np.abs(np.fft.rfft(a * np.hanning(len(a)))); fr = np.fft.rfftfreq(len(a), 1/16000)
    print(f"{f.split('/')[-1]:16s} centroid={np.sum(sp*fr)/np.sum(sp):6.0f}Hz  {' '.join(out)}")
