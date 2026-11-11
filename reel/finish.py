# Encode frames + mix -> final MP4, then QA.
import subprocess, json, sys, os, re, glob
HERE = os.path.dirname(os.path.abspath(__file__))
SP = os.path.join(HERE, 'build')
FR = os.path.join(SP, 'frames')
WM = os.path.join(HERE, 'watermark.png')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'grace_boss_charger_1080p.mp4')
NF = 1712; DUR = NF / 60.0
n = len(glob.glob(os.path.join(FR, 'f*.jpg')))
assert n == NF, f'frames on disk {n}/{NF}'
# pass 1: measure loudness
r = subprocess.run(['ffmpeg', '-hide_banner', '-i', os.path.join(SP, 'mix_raw.wav'), '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
m = json.loads(r[r.rindex('{'):r.rindex('}') + 1])
ln = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
      f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
cmd = ['ffmpeg', '-y', '-hide_banner', '-v', 'error', '-framerate', '60', '-i', os.path.join(FR, 'f%04d.jpg'), '-i', os.path.join(SP, 'mix_raw.wav'), '-loop', '1', '-framerate', '60', '-i', WM,
       '-filter_complex', f'[0:v][2:v]overlay=0:0:shortest=1[v];[1:a]{ln},aresample=48000,apad,atrim=0:{DUR:.6f}[a]',
       '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-profile:v', 'high', '-level', '4.2',
       '-pix_fmt', 'yuv420p', '-r', '60', '-g', '120', '-maxrate', '30M', '-bufsize', '60M', '-x264-params', 'aq-mode=3',
       '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', '-t', f'{DUR:.6f}', OUT]
subprocess.run(cmd, check=True)
# QA
pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels,duration',
                                '-of', 'json', OUT], capture_output=True, text=True).stdout)
print(json.dumps(pr, indent=1))
fz = subprocess.run(['ffmpeg', '-hide_banner', '-i', OUT, '-vf', 'freezedetect=n=0.0008:d=0.5,blackdetect=d=0.2:pix_th=0.06', '-an', '-f', 'null', '-'], capture_output=True, text=True).stderr
print('freeze/black:', [l for l in fz.splitlines() if 'freeze' in l or 'black_' in l] or 'none')
lu = subprocess.run(['ffmpeg', '-hide_banner', '-i', OUT, '-af', 'ebur128=peak=true', '-vn', '-f', 'null', '-'], capture_output=True, text=True).stderr
print('loudness:', [l.strip() for l in lu.splitlines()[-14:] if 'I:' in l or 'Peak:' in l])
qa = os.path.join(SP, 'qa_sheet.jpg')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', OUT, '-vf', 'fps=2,scale=216:384,tile=10x6', '-frames:v', '1', qa], check=True)
print('qa sheet', qa)
