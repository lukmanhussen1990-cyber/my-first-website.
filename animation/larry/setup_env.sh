#!/bin/bash
# Rebuild everything the Larry pipeline needs on a fresh Linux machine / Claude Code cloud session.
# Idempotent: re-running skips what is already there. Downloads ~2-3 GB, takes ~10-15 min.
# Usage: bash animation/larry/setup_env.sh
set -e
B=/opt/blender-4.5.16-linux-x64/blender
MPFB_DIR=~/.config/blender/4.5/extensions/user_default/mpfb
UD=~/.config/blender/4.5/extensions/.user/user_default/mpfb/data   # MPFB user data (asset packs)

echo "== 1/8 system tools"
need=""
command -v ffmpeg >/dev/null || need="$need ffmpeg"
command -v xvfb-run >/dev/null || need="$need xvfb libgl1-mesa-dri"
[ -f /usr/share/fonts/opentype/inter/Inter-ExtraBold.otf ] || need="$need fonts-inter"
[ -f /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf ] || need="$need fonts-dejavu-core"
if [ -n "$need" ]; then apt-get update -q && apt-get install -y -q $need; fi
python3 -c "import numpy, PIL" 2>/dev/null || pip install -q numpy pillow

echo "== 2/8 Blender 4.5.16 LTS"
if [ ! -x $B ]; then
  curl -sSfL --retry 4 https://download.blender.org/release/Blender4.5/blender-4.5.16-linux-x64.tar.xz | tar -xJ -C /opt
fi
$B --version 2>/dev/null | head -1

echo "== 3/8 MPFB 2.0.18 (MakeHuman for Blender)"
mkdir -p /opt/mh_assets/packs
if [ ! -d $MPFB_DIR ]; then
  curl -sSfL --retry 3 -o /opt/mh_assets/mpfb.zip \
    "https://extensions.blender.org/download/sha256:c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad/add-on-mpfb-v2.0.18.zip"
  $B -b --factory-startup -c extension install-file --repo user_default --enable /opt/mh_assets/mpfb.zip
fi

echo "== 4/8 MakeHuman asset packs (skins, hair, clothes, face units)"
get_pack() {  # $1 = path under /asset_packs/ ; tries both MakeHuman file hosts
  local f; f=/opt/mh_assets/packs/$(basename "$1")
  unzip -tq "$f" >/dev/null 2>&1 && return 0
  for host in files files2; do
    curl -sSfL --retry 3 -o "$f" "https://$host.makehumancommunity.org/asset_packs/$1" 2>/dev/null && unzip -tq "$f" >/dev/null 2>&1 && return 0
  done
  echo "FAILED to download $1"; return 1
}
if [ ! -d $UD/clothes ]; then
  for p in makehuman_system_assets/makehuman_system_assets_cc0.zip makehuman_system_poses/makehuman_system_poses_cc0.zip \
           shirts01/shirts01_cc0.zip shirts02/shirts02_ccby.zip shirts03/shirts03_ccby.zip pants01/pants01_cc0.zip \
           shoes01/shoes01_cc0.zip suits01/suits01_cc0.zip hats02/hats02_cc0.zip glasses01/glasses01_cc0.zip \
           glasses02/glasses02_ccby.zip bodyparts05/bodyparts05_cc0.zip bodyparts06/bodyparts06_cc-by.zip \
           hair02/hair02_ccby.zip skins02/skins02_cc0.zip eyebrows01/eyebrows01_cc0.zip eyelashes01/eyelashes01_cc0.zip \
           system_eye_materials01/system_eye_materials01_cc0.zip; do
    get_pack $p
  done
  F=/opt/mh_assets/packs/faceunits01.zip   # ARKit face shape keys (smile, jawOpen, blink...)
  unzip -tq $F >/dev/null 2>&1 || curl -sSfL --retry 3 -o $F https://files2.makehumancommunity.org/functional/faceunits01.zip
  mkdir -p $UD
  for z in /opt/mh_assets/packs/*.zip; do unzip -q -o "$z" -d $UD; done
  # Downscale textures (1K, skins 2K): full-size textures make multi-character shots run out of RAM.
  python3 - "$UD" <<'EOF'
import glob, os, sys
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
UD = sys.argv[1]; n = 0
for f in glob.glob(UD + "/**/*.png", recursive=True) + glob.glob(UD + "/**/*.jpg", recursive=True):
    try:
        im = Image.open(f); w, h = im.size
    except Exception:
        continue
    lim = 2048 if "/skins/" in f else 1024
    if max(w, h) <= lim:
        continue
    s = lim / max(w, h)
    im2 = im.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)
    im2.save(f) if f.lower().endswith(".png") else im2.convert("RGB").save(f, quality=92)
    n += 1
print("downscaled", n, "textures")
EOF
fi

echo "== 5/8 CMU motion capture (clips used so far + searchable index of all clips)"
mkdir -p /opt/cmu/amc
for id in 120_08 120_09 120_10 139_29 139_31 139_14 139_01 77_14 77_15 79_37 79_36 79_70 80_25 80_26 137_28 \
          137_41 137_32 137_19 141_16 141_20 141_18 141_23 138_01 138_02 70_01 70_10 07_01 07_02 90_16 13_14 \
          13_01 13_11 15_06 15_07 62_19 86_09 140_06 140_07 40_10 18_10 26_09 13_10 02_01 20_06 21_06 115_01 \
          136_09 111_37 105_18; do
  s=${id%_*}
  [ -s /opt/cmu/amc/$s.asf ] || curl -sSf --retry 3 -o /opt/cmu/amc/$s.asf http://mocap.cs.cmu.edu/subjects/$s/$s.asf
  [ -s /opt/cmu/amc/$id.amc ] || curl -sSf --retry 3 -o /opt/cmu/amc/$id.amc http://mocap.cs.cmu.edu/subjects/$s/$id.amc
done
if [ ! -s /opt/cmu/index.json ]; then
  curl -sSf --max-time 120 "http://mocap.cs.cmu.edu/search.php?subjectnumber=%&motion=%" -o /opt/cmu/search.html
  python3 - <<'EOF'
import re, html, json
s = open('/opt/cmu/search.html', encoding='latin-1').read()
out = []
for m in re.finditer(r'<TR BGCOLOR=#[0-9A-F]+><TD></TD><TD>(\d+)</TD><TD>(.*?)</TD>(.*?)</TR>', s, re.S):
    desc, rest = html.unescape(m.group(2)).strip(), m.group(3)
    amc = re.search(r'/subjects/(\d+)/(\d+_\d+)\.amc', rest)
    fr = re.findall(r'<TD>(\d+)</TD>', rest)
    if amc:
        out.append({"subj": amc.group(1), "id": amc.group(2), "desc": desc, "fps": fr[-1] if fr else ""})
json.dump(out, open('/opt/cmu/index.json', 'w'))
print(len(out), "CMU clips indexed (search /opt/cmu/index.json by 'desc')")
EOF
fi

echo "== 6/8 caption fonts"
mkdir -p /opt/fonts
for spec in "Montserrat 900 Black" "Montserrat 800 ExtraBold" "Poppins 900 Black" "Poppins 800 ExtraBold"; do
  set -- $spec
  [ -s /opt/fonts/$1-$3.ttf ] && continue
  url=$(curl -s -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=$1:wght@$2" | grep -o "https://fonts.gstatic.com[^)]*" | head -1)
  curl -sSf -o /opt/fonts/$1-$3.ttf "$url"
done

echo "== 7/8 OpenGameArt props (tank, jets)"
mkdir -p /opt/props/oga
for z in TankAndProps_0 basic_replacements.blend cimpletoon; do
  [ -d /opt/props/oga/$z ] && continue
  curl -sSfL --retry 3 -o /opt/props/oga/$z.zip https://opengameart.org/sites/default/files/$z.zip
  mkdir -p /opt/props/oga/$z && unzip -q -o /opt/props/oga/$z.zip -d /opt/props/oga/$z
done

echo "== 8/8 faster-whisper (word timings of the voiceover)"
[ -x /opt/whisper/bin/python ] || { python3 -m venv /opt/whisper && /opt/whisper/bin/pip install -q faster-whisper; }

echo "SETUP DONE. Poly Haven models/textures/skies download on demand (scripts/polyhaven.py -> /opt/polyhaven)."
