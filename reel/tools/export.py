#!/usr/bin/env python3
"""Final export: voice placement + word-by-word subtitles + audio mix + MP4.

Uses only the Python standard library and ffmpeg/ffprobe (ffmpeg needs libass for subtitles).
It never re-renders the 3D: it takes the subtitle-free picture ("clean plate") and adds
voice, subtitles, music and sound effects on top.

  python3 tools/export.py                       # uses voice/lines + voice/timings
  python3 tools/export.py --out output/test.mp4

Inputs
  output/clean_plate_no_subs.part1.mp4 + part2.mp4   3D render without subtitles/audio
                                   (split in two so each file stays under GitHub's 100 MB limit)
  audio/stems/sfx.flac             code-synthesized sound effects (music.flac only with --with-music)
  voice/lines/line_XX.wav          narration, one file per script line
  voice/timings/line_XX.json       word timings for each line (seconds from the start of its wav)
  script/voiceover.json            the script (spelling, scene windows, anchor words)
"""
import argparse, glob, json, os, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1080, 1920
SUB_X, SUB_Y = 520, 778          # centre, a little above the middle; clear of the right-side buttons
MAX_TEXT_W = 760                  # px; long words shrink to fit
BASE_SIZE, EMPH_SIZE = 124, 148


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        sys.stderr.write(r.stderr[-4000:])
        raise SystemExit(f'command failed: {" ".join(cmd[:6])} ...')
    return r


def duration(path):
    r = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path])
    return float(r.stdout.strip())


# ------------------------------------------------------------------ voice placement
def place_lines(script, vdir):
    placed = []
    for line in script['lines']:
        lid = line['id']
        tj = json.load(open(os.path.join(vdir, 'timings', f'line_{lid:02d}.json')))
        words = tj['words']
        toks = line['text'].split()
        if len(words) != len(toks):
            raise SystemExit(f'line {lid}: timing file has {len(words)} words, script has {len(toks)}')
        s0, s1 = words[0]['start'], words[-1]['end']
        w0, w1 = line['window']
        tempo = 1.0
        if (s1 - s0) > (w1 - w0):  # too long for its scene: gently speed up (max 25%)
            tempo = min(1.25, (s1 - s0) / (w1 - w0) * 1.01)
            print(f'  line {lid}: {s1 - s0:.2f}s speech > {w1 - w0:.2f}s window -> tempo x{tempo:.3f}')
        sc = 1.0 / tempo
        a = line.get('anchor_word', 0)
        offset = line['anchor_time'] - words[a]['start'] * sc
        lo, hi = w0 - s0 * sc, w1 - s1 * sc
        offset = min(max(offset, lo), max(lo, hi))
        gw = [{'word': tok, 'start': offset + w['start'] * sc, 'end': offset + w['end'] * sc} for tok, w in zip(toks, words)]
        placed.append({'id': lid, 'scene': line['scene'], 'offset': offset, 'tempo': tempo, 'words': gw,
                       'emphasis': set(line.get('emphasis', [])), 'wav': os.path.join(vdir, 'lines', f'line_{lid:02d}.wav')})
        print(f'  line {lid}: starts {offset + s0 * sc:6.2f}s, ends {offset + s1 * sc:6.2f}s (window {w0}-{w1})')
    return placed


def build_voice_track(placed, total, tmp):
    inputs, filters = [], []
    for i, p in enumerate(placed):
        inputs += ['-i', p['wav']]
        chain = f'[{i}:a]aresample=48000,aformat=channel_layouts=mono'
        if abs(p['tempo'] - 1) > 1e-3:
            chain += f',atempo={p["tempo"]:.4f}'
        d = max(0, int(round(p['offset'] * 1000)))
        trim = '' if p['offset'] >= 0 else f',atrim=start={-p["offset"]:.3f},asetpts=PTS-STARTPTS'
        chain += f'{trim},adelay={d}|{d}[v{i}]'
        filters.append(chain)
    mix = ''.join(f'[v{i}]' for i in range(len(placed))) + f'amix=inputs={len(placed)}:normalize=0:dropout_transition=0,apad,atrim=0:{total:.3f}[out]'
    out = os.path.join(tmp, 'voice.wav')
    run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filters + [mix]), '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s24le', out])
    return out


# ------------------------------------------------------------------ subtitles (ASS)
def text_width(word, size, metrics):
    wd = metrics['widths']
    return sum(wd.get(c, 0.55) for c in word) * size


def ass_time(t):
    t = max(0, t)
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'


def ass_escape(w):
    return w.replace('\\', '\\\\').replace('{', '(').replace('}', ')')


def build_ass(placed, path, metrics):
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,Fredoka Reel,{BASE_SIZE},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,1,0,1,11,0,5,40,40,40,1
Style: Shadow,Fredoka Reel,{BASE_SIZE},&H96000000,&H96000000,&H96000000,&H00000000,-1,0,0,0,100,100,1,0,1,11,0,5,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    words = [(p, w) for p in placed for w in p['words']]
    for i, (p, w) in enumerate(words):
        start = w['start'] - 0.03
        nxt = words[i + 1][1]['start'] - 0.03 if i + 1 < len(words) else w['end'] + 0.6
        end = min(nxt, w['end'] + 0.45) if nxt - w['end'] > 0.6 else nxt
        end = max(end, start + 0.12)
        clean = w['word'].strip('.,!?;:')
        storm = 6 <= p['scene'] <= 9
        emph = storm and clean in p['emphasis']
        size = EMPH_SIZE if emph else BASE_SIZE
        tw = text_width(w['word'], size, metrics) + 18
        if tw > MAX_TEXT_W:
            size = int(size * MAX_TEXT_W / tw)
        if emph:
            pop = r'\fscx45\fscy45\t(0,110,\fscx124\fscy124)\t(110,200,\fscx96\fscy96)\t(200,260,\fscx100\fscy100)'
        else:
            pop = r'\fscx72\fscy72\t(0,90,\fscx110\fscy110)\t(90,170,\fscx100\fscy100)'
        txt = ass_escape(w['word'])
        a, b = ass_time(start), ass_time(end)
        # soft drop shadow (blurred, offset), then the word with a thick black outline
        events.append(f'Dialogue: 0,{a},{b},Shadow,,0,0,0,,{{\\an5\\pos({SUB_X + 6},{SUB_Y + 10})\\fs{size}\\blur10\\bord14{pop}}}{txt}')
        events.append(f'Dialogue: 1,{a},{b},Word,,0,0,0,,{{\\an5\\pos({SUB_X},{SUB_Y})\\fs{size}\\blur0.8{pop}}}{txt}')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(head + '\n'.join(events) + '\n')
    return len(words)


def build_srt(placed, path):
    with open(path, 'w', encoding='utf-8') as f:
        for i, p in enumerate(placed, 1):
            s, e = p['words'][0]['start'], p['words'][-1]['end'] + 0.2
            fmt = lambda t: f'{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{int(t % 60):02d},{int(round((t % 1) * 1000)) % 1000:03d}'
            f.write(f'{i}\n{fmt(s)} --> {fmt(e)}\n{" ".join(w["word"] for w in p["words"])}\n\n')


# ------------------------------------------------------------------ mix
def mix_audio(voice, music, sfx, total, tmp):
    """Voice + sound effects (+ optional music); effects and music duck under the voice."""
    if music is None:  # default: no music
        inputs = ['-i', voice, '-i', sfx]
        graph = (
            '[0:a]aformat=channel_layouts=stereo,volume=1.0,asplit=2[v][vk];'
            '[1:a]aformat=channel_layouts=stereo,volume=0.72[s];'
            '[s][vk]sidechaincompress=threshold=0.03:ratio=2.2:attack=15:release=300:makeup=1[sd];'
            f'[v][sd]amix=inputs=2:normalize=0:dropout_transition=0,atrim=0:{total:.3f},lowpass=f=16000:p=2[mix]'
        )
    else:
        inputs = ['-i', voice, '-i', music, '-i', sfx]
        graph = (
            '[0:a]aformat=channel_layouts=stereo,volume=1.0,asplit=3[v][vk1][vk2];'
            '[1:a]aformat=channel_layouts=stereo,volume=0.7[m];'
            '[2:a]aformat=channel_layouts=stereo,volume=0.72[s];'
            '[m][vk1]sidechaincompress=threshold=0.02:ratio=3.5:attack=20:release=420:makeup=1[md];'
            '[s][vk2]sidechaincompress=threshold=0.03:ratio=2.2:attack=15:release=300:makeup=1[sd];'
            f'[v][md][sd]amix=inputs=3:normalize=0:dropout_transition=0,atrim=0:{total:.3f},lowpass=f=16000:p=2[mix]'
        )
    pre = os.path.join(tmp, 'premix.wav')
    run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', graph, '-map', '[mix]', '-ar', '48000', '-c:a', 'pcm_s24le', pre])
    # two-pass loudness normalisation to -14 LUFS (social video); -3 dBTP leaves headroom for AAC overshoot
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', pre, '-af', 'loudnorm=I=-14:TP=-3.0:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
    js = r.stderr[r.stderr.rfind('{'):r.stderr.rfind('}') + 1]
    m = json.loads(js)
    out = os.path.join(tmp, 'mix.wav')
    af = (f'loudnorm=I=-14:TP=-3.0:LRA=11:measured_I={m["input_i"]}:measured_TP={m["input_tp"]}:measured_LRA={m["input_lra"]}:'
          f'measured_thresh={m["input_thresh"]}:offset={m["target_offset"]}:linear=true,aresample=48000')
    run(['ffmpeg', '-y', '-loglevel', 'error', '-i', pre, '-af', af, '-ar', '48000', '-c:a', 'pcm_s24le', out])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--plate', default=None, help='subtitle-free render (default: output/clean_plate_no_subs.part*.mp4 joined)')
    ap.add_argument('--voice-dir', default=os.path.join(ROOT, 'voice'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'output/john_powers_the_city.mp4'))
    ap.add_argument('--with-music', action='store_true', help='also mix in audio/stems/music.flac (off by default: no music)')
    ap.add_argument('--crf', default='19')
    ap.add_argument('--maxrate', default='11M', help='bitrate cap so the Reel stays under ~100 MB')
    args = ap.parse_args()
    if shutil.which('ffmpeg') is None:
        raise SystemExit('ffmpeg not found')
    script = json.load(open(os.path.join(ROOT, 'script/voiceover.json')))
    metrics = json.load(open(os.path.join(ROOT, 'assets/fonts/FredokaReel-Bold.metrics.json')))
    with tempfile.TemporaryDirectory() as tmp:
        if args.plate is None:
            single = os.path.join(ROOT, 'output/clean_plate_no_subs.mp4')
            parts = sorted(glob.glob(os.path.join(ROOT, 'output/clean_plate_no_subs.part*.mp4')))
            if os.path.exists(single):
                args.plate = single
            elif parts:
                lst = os.path.join(tmp, 'parts.txt')
                with open(lst, 'w') as f:
                    f.writelines(f"file '{p}'\n" for p in parts)
                args.plate = os.path.join(tmp, 'plate.mp4')
                run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', args.plate])
            else:
                raise SystemExit('no clean plate found in output/ (render it with tools/render_all.sh + tools/make_plate.sh)')
        total = duration(args.plate)
        print(f'plate: {os.path.relpath(args.plate, ROOT) if args.plate.startswith(ROOT) else args.plate} ({total:.2f}s)')
        print('placing narration:')
        placed = place_lines(script, args.voice_dir)
        voice = build_voice_track(placed, total, tmp)
        ass = os.path.join(ROOT, 'output/subtitles.ass')
        n = build_ass(placed, ass, metrics)
        build_srt(placed, os.path.join(ROOT, 'output/subtitles.srt'))
        print(f'subtitles: {n} words -> {os.path.relpath(ass, ROOT)}')
        music = os.path.join(ROOT, 'audio/stems/music.flac') if args.with_music else None
        print('audio: voice + sound effects' + (' + music' if music else ' (no music)'))
        mix = mix_audio(voice, music, os.path.join(ROOT, 'audio/stems/sfx.flac'), total, tmp)
        shutil.copy(mix, os.path.join(ROOT, 'output/final_mix.wav'))
        fontsdir = os.path.join(ROOT, 'assets/fonts')
        vf = f"ass='{ass}':fontsdir='{fontsdir}'"
        os.makedirs(os.path.dirname(args.out), exist_ok=True)
        run(['ffmpeg', '-y', '-loglevel', 'error', '-i', args.plate, '-i', mix, '-map', '0:v:0', '-map', '1:a:0', '-vf', vf,
             '-c:v', 'libx264', '-preset', 'slow', '-crf', args.crf, '-maxrate', args.maxrate, '-bufsize', '22M',
             '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p', '-r', '30', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
             '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', '-shortest', args.out])
        json.dump([{**{k: v for k, v in p.items() if k not in ('emphasis',)}, 'emphasis': sorted(p['emphasis'])} for p in placed],
                  open(os.path.join(ROOT, 'output/voice_placement.json'), 'w'), indent=1)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
