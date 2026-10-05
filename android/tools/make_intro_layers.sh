#!/usr/bin/env bash
# Splits the icon artwork into the three layers the opening intro animates
# (needs ImageMagick: the `convert` command).
#
#   bash android/tools/make_intro_layers.sh                    -> uses android/icon/icon-source.png
#   bash android/tools/make_intro_layers.sh my-art.png         -> uses your own picture
#
# Written files (website/intro/):
#   scene.jpg   the figure, the blood moon and the dark texture, with the lettering erased and the edges faded to black
#   name.png    the white crown + big name (transparent background)
#   badass.png  the red tag line with its underline (transparent background)
#
# The numbers below are for the Imran BADASS artwork (a 1254 px square with a red outline);
# for different artwork you will want to adjust the regions.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${1:-$HERE/../icon/icon-source.png}"
OUT="$HERE/../../website/intro"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

BOX=1054; OFF=100          # square cut out from inside the red outline of the artwork
SZ=960                     # size of every layer in pixels (all layers are the same size, so they line up)
S() { echo $(( $1 * SZ / BOX )); }    # artwork pixel -> layer pixel

# 1. the artwork, cut and scaled
convert "$SRC" -alpha off -crop ${BOX}x${BOX}+${OFF}+${OFF} +repage -filter Lanczos -resize ${SZ}x${SZ}! "$TMP/art.png"

# 2. "how red" every pixel is (red minus the stronger of green/blue), stretched to 0..1
convert "$TMP/art.png" -fx 'max(0, u.r - max(u.g, u.b))' -clamp -level 6%,72% "$TMP/redness.png"

# 3. "how white" every pixel is (the weakest of red/green/blue), stretched to 0..1
convert "$TMP/art.png" -channel RGB -separate +channel -evaluate-sequence min -level 46%,80% "$TMP/whiteness.png"

# 4. masks (white = keep). Each is drawn on its own and blurred a little so the edges are soft.
box() {  # rectangle (rounded):  box name x0 y0 x1 y1 radius blur   (artwork coordinates)
  local f=$1; shift
  convert -size ${SZ}x${SZ} xc:black -fill white \
    -draw "roundrectangle $(S $(($1 - OFF))),$(S $(($2 - OFF))) $(S $(($3 - OFF))),$(S $(($4 - OFF))) $(S $5),$(S $5)" \
    -blur 0x$6 -colorspace Gray "$TMP/$f.png"
}
box inside  130  130 1125 1125 260 22    # inside the red outline, soft edge (the scene fades to black here)
box crown   470  380  790  605  20 4     # the crown
box letters 150  590 1060  975  20 4     # the big name
box tag     340  845  930 1100  30 3     # tag line + underline
convert "$TMP/crown.png" "$TMP/letters.png" -compose Lighten -composite "$TMP/nameBand.png"

# 5. the two lettering layers: colour + "how much" -> transparent PNG
layer() {  # layer colour amount-image mask-image out.png
  convert "$2" "$3" -compose Multiply -composite "$TMP/amount.png"
  convert -size ${SZ}x${SZ} xc:"$1" "$TMP/amount.png" -alpha off -compose CopyOpacity -composite -strip -define png:compression-level=9 "$4"
}
layer '#ffffff' "$TMP/whiteness.png" "$TMP/nameBand.png" "$OUT/name.png"
layer '#ff2b1d' "$TMP/redness.png"   "$TMP/tag.png"      "$OUT/badass.png"

# 6. the scene: the artwork with the lettering painted out (a little wider than the letters), faded to black at the edges
convert "$TMP/whiteness.png" "$TMP/nameBand.png" -compose Multiply -composite -morphology Dilate Disk:7 -blur 0x1.5 "$TMP/knockName.png"
convert "$TMP/redness.png"   "$TMP/tag.png"      -compose Multiply -composite -morphology Dilate Disk:7 -blur 0x1.5 "$TMP/knockTag.png"
convert "$TMP/knockName.png" "$TMP/knockTag.png" -compose Lighten -composite "$TMP/knock.png"
#    the painted-out areas get the average colour of whatever is around them (blur of the kept pixels / blur of the mask),
#    so no ghost of the letters is left behind
convert "$TMP/knock.png" -negate "$TMP/keep.png"
convert "$TMP/art.png" "$TMP/keep.png" -compose Multiply -composite -blur 0x22 "$TMP/around.png"
convert "$TMP/keep.png" -blur 0x22 "$TMP/weight.png"
convert "$TMP/around.png" "$TMP/weight.png" -compose Divide_Src -composite "$TMP/fill.png"
convert "$TMP/art.png" "$TMP/fill.png" "$TMP/knock.png" -composite "$TMP/scene0.png"
convert -size ${SZ}x${SZ} xc:black "$TMP/scene0.png" "$TMP/inside.png" -composite -quality 90 -sampling-factor 4:2:0 -strip "$OUT/scene.jpg"

ls -la "$OUT"
