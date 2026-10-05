#!/usr/bin/env python3
"""End-to-end device test: plays Block Blast on a real Android device or
emulator through adb, using only what is visible on screen.

It launches the installed release APK, captures the splash screens, then
repeatedly reads the board and the tray from a screenshot, picks the best
move (most lines cleared), drags the piece with `adb shell input swipe`
and checks through the app's logcat markers (BB_MOVE) that the move was
accepted and scored. It plays until game over, checks the game-over popup,
starts a new game, opens the settings popup and finally verifies that an
unfinished game is restored after the app is killed.

Usage: python3 tool/device_bot.py <out_dir>
Env:   ADB (default "adb"), MAX_MOVES (default 70)
"""
import io
import os
import re
import shutil
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

from PIL import Image

ADB = os.environ.get('ADB', 'adb')
PKG = 'com.myapps.blockblast'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'device_out'
MAX_MOVES = int(os.environ.get('MAX_MOVES', '70'))
os.makedirs(OUT, exist_ok=True)

BG = (58, 81, 147)
failures = []


def log(*a):
    print('[bot]', *a, flush=True)


def fail(msg):
    log('FAIL:', msg)
    failures.append(msg)


def adb(*args, check=False, timeout=60):
    return subprocess.run([ADB, *args], capture_output=True, timeout=timeout, check=check)


def shell(cmd, timeout=60):
    return adb('shell', cmd, timeout=timeout).stdout.decode(errors='replace')


def screencap():
    for _ in range(5):
        r = adb('exec-out', 'screencap', '-p')
        if r.returncode == 0 and r.stdout[:8] == b'\x89PNG\r\n\x1a\n':
            return Image.open(io.BytesIO(r.stdout)).convert('RGB')
        time.sleep(1)
    raise RuntimeError('screencap failed')


def save(img, name):
    path = os.path.join(OUT, name + '.png')
    img.save(path)
    log('saved', path)


def shot(name):
    img = screencap()
    save(img, name)
    return img


def logcat_markers():
    out = adb('logcat', '-d', '-s', 'flutter:I', 'flutter:E', 'flutter:W', timeout=60).stdout.decode(errors='replace')
    return out


def last_move():
    moves = re.findall(r'BB_MOVE n=(\d+) piece=(\S+) at=(\d+),(\d+) score=(\d+) lines=(\d+) combo=(\d+) over=(\w+)',
                       logcat_markers())
    return moves[-1] if moves else None


# ---------------------------------------------------------------------------
# Screen analysis
# ---------------------------------------------------------------------------

def is_dark(c):
    # Board cells (35,42,84) and grid lines (28,35,73); excludes the frame (44,59,116).
    r, g, b = c
    return r < 48 and g < 56 and 55 < b < 100


def diff_bg(c):
    return max(abs(c[0] - BG[0]), abs(c[1] - BG[1]), abs(c[2] - BG[2]))


class Geometry:
    def __init__(self, left, top, right, bottom):
        self.left, self.top, self.right, self.bottom = left, top, right, bottom
        self.cell = (right - left) / 8.0
        self.u = (right - left) / 88.0
        outer_left = left - self.u
        self.tray_y = bottom + 26 * self.u
        self.slots = [outer_left + self.u * (15 + 30 * i) for i in range(3)]
        self.tray_cell = min(self.cell * 0.6, 5.6 * self.u)

    def __repr__(self):
        return (f'grid=({self.left:.0f},{self.top:.0f})-({self.right:.0f},{self.bottom:.0f}) '
                f'cell={self.cell:.1f} trayY={self.tray_y:.0f} trayCell={self.tray_cell:.1f}')


def find_board(img):
    """Locates the 8x8 grid on an (empty or partly empty) board."""
    w, h = img.size
    px = img.load()
    rows = []
    for y in range(int(h * 0.12), int(h * 0.8), 3):
        run_start, gap, best_row = None, 0, (0, 0, 0)
        for x in range(w):
            if is_dark(px[x, y]):
                if run_start is None:
                    run_start = x
                gap = 0
                if x - run_start > best_row[0]:
                    best_row = (x - run_start, run_start, x)
            elif run_start is not None:
                gap += 1
                if gap > 4:
                    run_start, gap = None, 0
        rows.append((best_row[0], best_row[1], best_row[2], y))
    longest = max(r[0] for r in rows)
    if longest < w * 0.5:
        raise RuntimeError(f'board not found (longest dark run {longest}px)')
    cand = [r for r in rows if r[0] >= longest * 0.97]
    cand.sort(key=lambda r: r[3])
    mid = cand[len(cand) // 2]
    left = sorted(r[1] for r in cand)[len(cand) // 2]
    right = sorted(r[2] for r in cand)[len(cand) // 2]
    y0 = mid[3]
    x = int(left + (right - left) / 16)  # middle of the first column
    top = y0
    while top > 0 and (is_dark(px[x, top - 1]) or is_dark(px[x, max(0, top - 4)])):
        top -= 1
    bottom = y0
    while bottom < h - 1 and (is_dark(px[x, bottom + 1]) or is_dark(px[x, min(h - 1, bottom + 4)])):
        bottom += 1
    g = Geometry(left, top, right + 1, bottom + 1)
    if abs((g.bottom - g.top) - (g.right - g.left)) > g.cell * 0.5:
        raise RuntimeError(f'board not square: {g}')
    return g


def read_board(img, g):
    px = img.load()
    board = []
    for r in range(8):
        row = []
        for c in range(8):
            cx = int(g.left + (c + 0.5) * g.cell)
            cy = int(g.top + (r + 0.5) * g.cell)
            samples = [px[cx + dx, cy + dy] for dx in (-3, 0, 3) for dy in (-3, 0, 3)]
            dark = sum(1 for s in samples if is_dark(s))
            row.append(dark < 5)
        board.append(row)
    return board


def read_tray(img, g):
    """Returns 3 entries of (cells, rows, cols) or None for empty slots."""
    px = img.load()
    w, h = img.size
    span = 15 * g.u
    pieces = []
    for sx in g.slots:
        x0, x1 = int(sx - span), int(sx + span)
        y0, y1 = int(g.tray_y - span), int(min(h - 1, g.tray_y + span))
        xs, ys = [], []
        for y in range(y0, y1, 2):
            for x in range(max(0, x0), min(w, x1), 2):
                if diff_bg(px[x, y]) > 42:
                    xs.append(x)
                    ys.append(y)
        if len(xs) < 20:
            pieces.append(None)
            continue
        bx0, bx1, by0, by1 = min(xs), max(xs), min(ys), max(ys)
        tc = g.tray_cell
        cols = max(1, round((bx1 - bx0 + 2) / tc))
        rows = max(1, round((by1 - by0 + 2) / tc))
        cw = (bx1 - bx0 + 2) / cols
        ch = (by1 - by0 + 2) / rows
        cells = []
        for r in range(rows):
            for c in range(cols):
                cx = int(bx0 + (c + 0.5) * cw)
                cy = int(by0 + (r + 0.5) * ch)
                hits = sum(1 for dx in (-2, 0, 2) for dy in (-2, 0, 2) if diff_bg(px[cx + dx, cy + dy]) > 42)
                if hits >= 5:
                    cells.append((r, c))
        if not cells:
            pieces.append(None)
            continue
        pieces.append((cells, rows, cols))
    return pieces


# ---------------------------------------------------------------------------
# Planning
# ---------------------------------------------------------------------------

def fits(board, cells, r0, c0):
    for r, c in cells:
        rr, cc = r0 + r, c0 + c
        if rr < 0 or rr > 7 or cc < 0 or cc > 7 or board[rr][cc]:
            return False
    return True


def evaluate(board, cells, r0, c0):
    b = [row[:] for row in board]
    for r, c in cells:
        b[r0 + r][c0 + c] = True
    rows = [r for r in range(8) if all(b[r])]
    cols = [c for c in range(8) if all(b[r][c] for r in range(8))]
    lines = len(rows) + len(cols)
    touch = 0
    for r, c in cells:
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            rr, cc = r0 + r + dr, c0 + c + dc
            if rr < 0 or rr > 7 or cc < 0 or cc > 7 or b[rr][cc]:
                touch += 1
    return lines * 1000 + touch * 3 - (r0 + c0) * 0.01, lines


def best_move(board, tray):
    best = None
    for slot, p in enumerate(tray):
        if p is None:
            continue
        cells, rows, cols = p
        for r0 in range(9 - rows):
            for c0 in range(9 - cols):
                if fits(board, cells, r0, c0):
                    score, lines = evaluate(board, cells, r0, c0)
                    if best is None or score > best[0]:
                        best = (score, slot, r0, c0, lines)
    return best


def drag(g, slot, rows, cols, r0, c0, ms=650):
    sx, sy = g.slots[slot], g.tray_y
    tx = g.left + (c0 + cols / 2) * g.cell
    ty = g.top + (r0 + rows / 2) * g.cell + rows * g.cell / 2 + 1.15 * g.cell
    shell(f'input swipe {int(sx)} {int(sy)} {int(tx)} {int(ty)} {ms}')


def find_text_bounds(text):
    """Finds an on-screen element by text via uiautomator (Flutter semantics)."""
    for _ in range(3):
        shell('uiautomator dump /sdcard/bb_ui.xml', timeout=90)
        xml = adb('exec-out', 'cat', '/sdcard/bb_ui.xml').stdout.decode(errors='replace')
        if '<hierarchy' not in xml:
            time.sleep(1)
            continue
        try:
            root = ET.fromstring(xml[xml.index('<hierarchy'):])
        except ET.ParseError:
            time.sleep(1)
            continue
        for node in root.iter('node'):
            label = (node.get('text') or '') + '|' + (node.get('content-desc') or '')
            if text.lower() in label.lower():
                m = re.findall(r'\d+', node.get('bounds', ''))
                if len(m) == 4:
                    x0, y0, x1, y1 = map(int, m)
                    return (x0 + x1) // 2, (y0 + y1) // 2
        time.sleep(1)
    return None


def find_gear(img, g):
    """Centroid of the light-blue gear icon above the board's right side."""
    px = img.load()
    xs, ys = [], []
    for y in range(0, int(g.top - 2 * g.u), 2):
        for x in range(int(g.left + (g.right - g.left) * 0.6), img.size[0], 2):
            r, gg, b = px[x, y]
            if b > 215 and gg > 195 and 140 < r < 235:
                xs.append(x)
                ys.append(y)
    if len(xs) < 15:
        return None
    return sum(xs) / len(xs), sum(ys) / len(ys)


def tap(x, y):
    shell(f'input tap {int(x)} {int(y)}')


# ---------------------------------------------------------------------------
# Scenario
# ---------------------------------------------------------------------------

def launch(prefix, splash_shots=True):
    """Starts the app. With splash_shots the launch is screen-recorded and
    frames are extracted (adb screencap is too slow on CI emulators)."""
    if not splash_shots:
        shell(f'am start -n {PKG}/.MainActivity', timeout=120)
        time.sleep(10)
        return
    remote = '/sdcard/bb_launch.mp4'
    shell(f'rm -f {remote}')
    rec = subprocess.Popen([ADB, 'shell', 'screenrecord', '--time-limit', '11', '--bit-rate', '6000000', remote])
    time.sleep(1.5)
    t0 = time.time()
    shell(f'am start -n {PKG}/.MainActivity', timeout=120)
    try:
        rec.wait(timeout=40)
    except subprocess.TimeoutExpired:
        rec.kill()
    time.sleep(1.0)
    local = os.path.join(OUT, prefix + 'launch.mp4')
    adb('pull', remote, local, timeout=120)
    if os.path.exists(local) and os.path.getsize(local) > 1000:
        # Frames are extracted when ffmpeg is available (not on GitHub runners).
        secs = (1.8, 2.6, 3.4, 4.3, 5.2, 6.4, 7.6, 9.0, 10.5) if shutil.which('ffmpeg') else ()
        for sec in secs:
            frame = os.path.join(OUT, f'{prefix}launch_{sec:04.1f}s.png')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(sec), '-i', local, '-frames:v', '1', frame])
        log('launch video saved', local)
    else:
        log('screenrecord unavailable, falling back to screencaps')
        for i in range(6):
            shot(f'{prefix}launch_cap{i}')
    remaining = 12 - (time.time() - t0)
    if remaining > 0:
        time.sleep(remaining)


def play_game(g, tag, max_moves):
    moves_done = 0
    expected_score = None
    lines_total = 0
    combos = 0
    stale = 0
    while moves_done < max_moves:
        img = screencap()
        board = read_board(img, g)
        tray = read_tray(img, g)
        if all(p is None for p in tray):
            time.sleep(0.6)
            stale += 1
            if stale > 5:
                fail('tray stayed empty')
                return 'stuck'
            continue
        mv = best_move(board, tray)
        if mv is None:
            log('no valid move left -> expecting game over')
            return 'over'
        _, slot, r0, c0, lines = mv
        cells, rows, cols = tray[slot]
        before = last_move()
        drag(g, slot, rows, cols, r0, c0)
        if lines and lines_total < 3:
            time.sleep(0.12)
            shot(f'{tag}clear_{lines_total}')
        time.sleep(1.0 if lines else 0.6)
        after = last_move()
        if after is None or after == before:
            time.sleep(0.8)
            after = last_move()
        if after is None or after == before:
            stale += 1
            save(img, f'{tag}unregistered_{moves_done}')
            log(f'move not registered: slot={slot} at {r0},{c0} shape={cells}')
            if stale > 4:
                fail('several drags were not registered')
                return 'stuck'
            continue
        stale = 0
        n, pid, ar, ac, score, got_lines, combo, over = after
        moves_done += 1
        size = len(cells)
        if (int(ar), int(ac)) != (r0, c0):
            fail(f'piece landed at {ar},{ac} instead of {r0},{c0}')
        if int(got_lines) != lines:
            fail(f'expected {lines} lines, app cleared {got_lines}')
        if expected_score is not None:
            bonus = 10 * int(got_lines) * (int(got_lines) + 1) // 2 * max(1, int(combo))
            if int(score) != expected_score + size + bonus:
                fail(f'score {score} != {expected_score} + {size} + {bonus}')
        expected_score = int(score)
        lines_total += int(got_lines)
        if int(combo) >= 2:
            combos += 1
            if combos <= 2:
                shot(f'{tag}combo_{combo}')
        log(f'move {moves_done}: {pid} at {ar},{ac} lines={got_lines} combo={combo} score={score}')
        if over == 'true':
            return 'over'
    return 'limit'


def main():
    sdk = shell('getprop ro.build.version.sdk').strip()
    size = shell('wm size').strip()
    log('device sdk', sdk, size)
    launch('01_')
    img = shot('02_game_start')
    g = find_board(img)
    log('geometry', g)

    result = play_game(g, '03_', MAX_MOVES)
    log('game 1 result:', result)
    shot('04_last_move')
    if result == 'over':
        time.sleep(3.5)
        shot('05_game_over')
        markers = logcat_markers()
        if 'over=true' not in markers:
            fail('game over not reported by the app')
        pos = find_text_bounds('Play Again')
        if pos is None:
            fail('Play Again button not found')
            w, h = screencap().size
            pos = (w // 2, int(h * 0.6))
        tap(*pos)
        time.sleep(1.5)
        img = shot('06_new_game')
        board = read_board(img, g)
        if any(any(r) for r in board):
            fail('board not empty after Play Again')
    elif result == 'stuck':
        save(screencap(), '05_stuck')

    # A few moves in the new game, then settings.
    play_game(g, '07_', 3)
    gear = find_gear(screencap(), g)
    if gear is None:
        fail('settings gear not found')
        gear = (g.right - 3 * g.u, g.top - 36 * g.u)
    tap(*gear)
    time.sleep(1.2)
    shot('08_settings')
    if find_text_bounds('Vibration') is None:
        fail('settings popup not shown')
    shell('input keyevent KEYCODE_BACK')
    time.sleep(1.0)
    shot('09_after_settings')

    # Kill and relaunch: the unfinished game must be restored.
    before = read_board(screencap(), g)
    shell(f'am force-stop {PKG}')
    time.sleep(1.0)
    launch('10_', splash_shots=False)
    img = shot('11_restored')
    after = read_board(img, g)
    if before != after:
        fail('saved game was not restored after restart')

    # Back button goes to the home screen.
    shell('input keyevent KEYCODE_BACK')
    time.sleep(1.5)
    shot('12_home')
    if find_text_bounds('Continue') is None and find_text_bounds('Classic') is None:
        fail('home screen not shown after back')

    errors = [l for l in logcat_markers().splitlines() if 'BB_ERROR' in l]
    if errors:
        fail('app reported errors: ' + ' | '.join(errors[:5]))

    with open(os.path.join(OUT, 'result.txt'), 'w') as f:
        f.write('PASS\n' if not failures else 'FAIL\n' + '\n'.join(failures) + '\n')
    log('RESULT', 'PASS' if not failures else 'FAIL', failures)
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
