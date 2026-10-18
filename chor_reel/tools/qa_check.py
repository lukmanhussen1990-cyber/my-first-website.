"""QA for the vertical recreation.
usage: qa_check.py <original.mp4> <output.mp4> <sheet_dir>
Checks: stream properties, audio bit-exactness (packet + decoded PCM MD5, packet table), frame count,
duration, sync (per-frame brightness correlation peak at lag 0), black/frozen-frame scan, and writes
side-by-side review sheets (original | vertical) sampled every second."""
import sys, os, json, subprocess, hashlib
import numpy as np, cv2


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout


def probe(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]))


def md5_copy(path):
    return run(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:a:0', '-c', 'copy', '-f', 'md5', '-']).strip()


def md5_pcm(path):
    return run(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:a:0', '-f', 'md5', '-']).strip()


def packet_table(path):
    out = run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_packets', '-show_entries',
               'packet=pts,dts,duration,size', '-of', 'csv=p=0', path])
    return hashlib.md5(out.encode()).hexdigest(), out.count('\n')


def frame_means(path, crop=None):
    cap = cv2.VideoCapture(path)
    vals = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        if crop is not None:
            f = f[crop[0]:crop[1]]
        vals.append(float(cv2.resize(f, (64, 64), interpolation=cv2.INTER_AREA).mean()))
    return np.array(vals)


def main():
    orig, out, sheet_dir = sys.argv[1:4]
    os.makedirs(sheet_dir, exist_ok=True)
    rep = {}
    po, pv = probe(orig), probe(out)
    vs = [s for s in pv['streams'] if s['codec_type'] == 'video'][0]
    as_ = [s for s in pv['streams'] if s['codec_type'] == 'audio'][0]
    ao = [s for s in po['streams'] if s['codec_type'] == 'audio'][0]
    rep['video'] = dict(codec=vs['codec_name'], profile=vs.get('profile'), size=f"{vs['width']}x{vs['height']}",
                        fps=vs['r_frame_rate'], frames=int(vs['nb_frames']), pix_fmt=vs['pix_fmt'],
                        duration=float(vs['duration']), color=(vs.get('color_space'), vs.get('color_primaries'),
                                                               vs.get('color_transfer'), vs.get('color_range')))
    rep['audio_out'] = dict(codec=as_['codec_name'], profile=as_.get('profile'), rate=as_['sample_rate'],
                            channels=as_['channels'], start=as_.get('start_time'), duration=as_.get('duration'),
                            packets=as_.get('nb_frames'))
    rep['audio_src'] = dict(codec=ao['codec_name'], profile=ao.get('profile'), rate=ao['sample_rate'],
                            channels=ao['channels'], start=ao.get('start_time'), duration=ao.get('duration'),
                            packets=ao.get('nb_frames'))
    rep['container_duration'] = dict(src=float(po['format']['duration']), out=float(pv['format']['duration']))
    rep['audio_packet_md5'] = dict(src=md5_copy(orig), out=md5_copy(out))
    rep['audio_pcm_md5'] = dict(src=md5_pcm(orig), out=md5_pcm(out))
    rep['audio_packet_table'] = dict(src=packet_table(orig), out=packet_table(out))
    rep['audio_identical'] = (rep['audio_packet_md5']['src'] == rep['audio_packet_md5']['out'] and
                              rep['audio_pcm_md5']['src'] == rep['audio_pcm_md5']['out'] and
                              rep['audio_packet_table']['src'] == rep['audio_packet_table']['out'])
    # sync: brightness curves (original active band vs. whole vertical frame)
    mo = frame_means(orig)
    mv = frame_means(out)
    n = min(len(mo), len(mv))
    a, b = mo[:n] - mo[:n].mean(), mv[:n] - mv[:n].mean()
    lags = range(-15, 16)
    corr = {L: float(np.corrcoef(a[max(0, L):n + min(0, L)], b[max(0, -L):n - max(0, L)])[0, 1]) for L in lags}
    best = max(corr, key=corr.get)
    rep['sync'] = dict(frames_src=len(mo), frames_out=len(mv), best_lag_frames=best, corr_at_0=round(corr[0], 4),
                       corr_best=round(corr[best], 4))
    # black / frozen frames (outside the fade-in/out)
    diffs = np.abs(np.diff(mv))
    rep['near_black_frames'] = [int(i) for i in np.where(mv < 2.0)[0] if 20 < i < 1570]
    cap = cv2.VideoCapture(out)
    prev, frozen = None, []
    i = 0
    while True:
        ok, f = cap.read()
        if not ok:
            break
        s = cv2.resize(f, (90, 160), interpolation=cv2.INTER_AREA).astype(np.int16)
        if prev is not None and np.abs(s - prev).max() == 0 and 20 < i < 1570:
            frozen.append(i)
        prev = s
        i += 1
    rep['identical_consecutive_frames'] = frozen[:50]
    rep['identical_consecutive_count'] = len(frozen)
    # review sheets: original (letterbox crop) above, vertical below, every 30 frames
    co, cv_ = cv2.VideoCapture(orig), cv2.VideoCapture(out)
    tiles = []
    k = 0
    while True:
        ok1, f1 = co.read()
        ok2, f2 = cv_.read()
        if not (ok1 and ok2):
            break
        if k % 30 == 15:
            t1 = cv2.resize(f1, (270, 152), interpolation=cv2.INTER_AREA)
            t2 = cv2.resize(f2, (270, 480), interpolation=cv2.INTER_AREA)
            t = np.vstack([t1, np.full((4, 270, 3), 60, np.uint8), t2])
            cv2.putText(t, f'{k / 30:.1f}s', (4, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
            tiles.append(t)
        k += 1
    per = 9
    for si in range(0, len(tiles), per):
        row = tiles[si:si + per]
        while len(row) < per:
            row.append(np.zeros_like(tiles[0]))
        cv2.imwrite(f'{sheet_dir}/review_{si // per:02d}.jpg', np.hstack([np.pad(t, ((2, 2), (2, 2), (0, 0))) for t in row]),
                    [cv2.IMWRITE_JPEG_QUALITY, 88])
    print(json.dumps(rep, indent=1, default=str))


if __name__ == '__main__':
    main()
