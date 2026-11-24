#!/bin/bash
# Rebuild the Larry pipeline in a cloud session whose network does NOT allow download.blender.org,
# extensions.blender.org, files2.makehumancommunity.org or mocap.cs.cmu.edu (used for Episode 2).
# Sources used instead (all reachable with "package managers" + Hugging Face + MakeHuman files host):
#   Blender 4.5.16  -> PyPI wheel `bpy==4.5.16` (Python 3.11) + a `blender` CLI stand-in at the usual path
#   MPFB 2.0.18     -> the official extension zip, uploaded by the user (sha256 checked)
#   MakeHuman packs -> files.makehumancommunity.org (asset_packs/ and functional/faceunits01.zip)
#   CMU mocap       -> Hugging Face codepawl/cmu-mocap-glb `skeleton/` clips, rebuilt to ASF/AMC by scripts/glb2amc.py
# Usage: bash animation/larry/setup_env_restricted.sh /path/to/add-on-mpfb-v2.0.18.zip
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
MPFB_ZIP=${1:?path to add-on-mpfb-v2.0.18.zip}
echo "c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad  $MPFB_ZIP" | sha256sum -c -

echo "== system libs (Eevee needs EGL; Mesa llvmpipe renders on CPU)"
apt-get install -y -q libegl1 libegl-mesa0 libgl1-mesa-dri libgl1 libglx-mesa0 xvfb fonts-inter fonts-dejavu-core \
  || (apt-get update -q && apt-get install -y -q libegl1 libegl-mesa0 libgl1-mesa-dri libgl1 libglx-mesa0 xvfb fonts-inter fonts-dejavu-core)

echo "== Blender 4.5.16 as a Python module"
[ -x /opt/bpy45/bin/python ] || python3.11 -m venv /opt/bpy45
/opt/bpy45/bin/pip install -q "bpy==4.5.16" numpy pygltflib
cat > /opt/bpy45/prelude.py <<'EOF'
"""Run a Blender script with the bpy module as if by `blender -b --python script.py -- args`.
Enables MPFB first, then hard-exits (bpy's module shutdown hangs once MPFB is loaded)."""
import os, sys, runpy, traceback
script, rest = sys.argv[1], sys.argv[2:]
import bpy, addon_utils
addon_utils.enable("bl_ext.user_default.mpfb", default_set=True, persistent=True)
sys.argv = [script] + rest
code = 0
try:
    runpy.run_path(script, run_name="__main__")
except SystemExit as e:
    code = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
except BaseException:
    traceback.print_exc(); code = 1
sys.stdout.flush(); sys.stderr.flush()
os._exit(code)
EOF
mkdir -p /opt/blender-4.5.16-linux-x64
cat > /opt/blender-4.5.16-linux-x64/blender <<'EOF'
#!/bin/bash
# `blender` stand-in backed by the bpy 4.5.16 module. Supports: blender [-b] (--python|-P) script.py [-- args]
script=""; rest=()
while [ $# -gt 0 ]; do
  case "$1" in
    --version|-v) /opt/bpy45/bin/python -c "import bpy; print('Blender', bpy.app.version_string)"; exit 0;;
    --python|-P) script="$2"; shift 2;;
    --) rest=("$@"); break;;
    *) shift;;
  esac
done
[ -z "$script" ] && { echo "blender stand-in: no --python script given" >&2; exit 2; }
exec /opt/bpy45/bin/python /opt/bpy45/prelude.py "$script" "${rest[@]}"
EOF
chmod +x /opt/blender-4.5.16-linux-x64/blender

echo "== MPFB 2.0.18 (extension files unpacked into the user_default repo, enabled by the prelude)"
EXT=~/.config/blender/4.5/extensions/user_default/mpfb
if [ ! -f $EXT/blender_manifest.toml ]; then
  mkdir -p $EXT && unzip -q -o "$MPFB_ZIP" -d $EXT
fi
grep '^version' $EXT/blender_manifest.toml

echo "== MakeHuman asset packs + ARKit face units"
UD=~/.config/blender/4.5/extensions/.user/user_default/mpfb/data
mkdir -p /opt/mh_assets/packs $UD
cd /opt/mh_assets/packs
for p in makehuman_system_assets/makehuman_system_assets_cc0.zip makehuman_system_poses/makehuman_system_poses_cc0.zip \
         shirts01/shirts01_cc0.zip shirts02/shirts02_ccby.zip shirts03/shirts03_ccby.zip pants01/pants01_cc0.zip \
         shoes01/shoes01_cc0.zip suits01/suits01_cc0.zip hats02/hats02_cc0.zip glasses01/glasses01_cc0.zip \
         glasses02/glasses02_ccby.zip bodyparts05/bodyparts05_cc0.zip bodyparts06/bodyparts06_cc-by.zip \
         hair02/hair02_ccby.zip skins02/skins02_cc0.zip eyebrows01/eyebrows01_cc0.zip eyelashes01/eyelashes01_cc0.zip \
         system_eye_materials01/system_eye_materials01_cc0.zip; do
  f=$(basename $p); unzip -tq $f >/dev/null 2>&1 && continue
  curl -sSfL --retry 4 -o $f "https://files.makehumancommunity.org/asset_packs/$p"
done
unzip -tq faceunits01.zip >/dev/null 2>&1 || curl -sSfL --retry 4 -o faceunits01.zip https://files.makehumancommunity.org/functional/faceunits01.zip
if [ ! -d $UD/clothes ]; then
  for z in /opt/mh_assets/packs/*.zip; do unzip -q -o "$z" -d $UD; done
  python3 - "$UD" <<'EOF'
import glob, sys
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

echo "== CMU mocap via Hugging Face (skeleton GLBs -> ASF/AMC)"
mkdir -p /opt/cmu/glb /opt/cmu/amc
HF=https://huggingface.co/datasets/codepawl/cmu-mocap-glb/resolve/main
declare -A CLIPS=( [07_01]=07_01-walk [70_01]=70_01-carry-5-5lb-suitcase [137_41]=137_41-strong-man-wait [137_28]=137_28-normal-wait
                   [09_01]=09_01-run [113_27]=113_27-wave [105_19]=105_19-march
                   [132_45]=132_45-walk-slow [79_73]=79_73-scared [113_07]=113_07-run [127_03]=127_03-run
                   [139_10]=139_10-run [143_42]=143_42-run )      # the extra ones were added for episodes 9-17
for id in "${!CLIPS[@]}"; do
  [ -s /opt/cmu/amc/$id.amc ] && continue
  n=${CLIPS[$id]}
  curl -sSfL --retry 4 -o /opt/cmu/glb/$id.glb "$HF/skeleton/$n/${n}_skeleton.glb"
  /opt/bpy45/bin/python $HERE/scripts/glb2amc.py /opt/cmu/glb/$id.glb $id /opt/cmu/amc
done

echo "== caption fonts"
mkdir -p /opt/fonts
for spec in "Montserrat 900 Black" "Montserrat 800 ExtraBold"; do
  set -- $spec
  [ -s /opt/fonts/$1-$3.ttf ] && continue
  url=$(curl -s -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=$1:wght@$2" | grep -o "https://fonts.gstatic.com[^)]*" | head -1)
  curl -sSf -o /opt/fonts/$1-$3.ttf "$url"
done
/opt/blender-4.5.16-linux-x64/blender --version
echo "RESTRICTED SETUP DONE"
