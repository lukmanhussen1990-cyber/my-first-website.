#!/usr/bin/env bash
# Makes every Android app-icon file from ONE picture (needs ImageMagick: the `convert` command).
#
#   tools/make_icons.sh path/to/icon.png            -> writes the icons into app/src/main/res/
#   tools/make_icons.sh path/to/icon.png "#100F0E"  -> same, with your own background colour
#
# Written files:
#   mipmap-*/ic_launcher_foreground.png   adaptive icon picture (Android 8+), scaled to stay inside the safe zone
#   mipmap-*/ic_launcher_monochrome.png   one-colour version for "themed icons" (Android 13+): crown + name (the white parts)
#   mipmap-*/ic_launcher.png              classic square icon (Android 7)
#   mipmap-*/ic_launcher_round.png        classic round icon
#   values/ic_launcher_background.xml     the colour behind the adaptive icon (also the splash-screen colour)
set -euo pipefail

SRC="${1:?usage: tools/make_icons.sh icon.png [\"#rrggbb\"]}"
RES="$(cd "$(dirname "$0")/.." && pwd)/app/src/main/res"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# background colour = average of the four corners of the picture (unless you give one)
if [ -n "${2:-}" ]; then
  BG="$2"
else
  BG=$(convert "$SRC" -alpha off -gravity northwest -crop 24x24+0+0 +repage -scale 1x1! "$TMP/c1.png" \
       && convert "$SRC" -alpha off -gravity northeast -crop 24x24+0+0 +repage -scale 1x1! "$TMP/c2.png" \
       && convert "$SRC" -alpha off -gravity southwest -crop 24x24+0+0 +repage -scale 1x1! "$TMP/c3.png" \
       && convert "$SRC" -alpha off -gravity southeast -crop 24x24+0+0 +repage -scale 1x1! "$TMP/c4.png" \
       && convert "$TMP"/c?.png +append -scale 1x1! -format '#%[hex:u.p{0,0}]' info:)
fi
echo "background colour: $BG"

K=16                       # work at 16 px per dp, then shrink for every screen density
CANVAS=$((108 * K))        # adaptive icon canvas = 108 dp
ART=$((80 * K))            # the picture fills 80 dp of it, so the important parts survive circle / squircle masks
FEATHER=$((ART / 28))      # the picture's outer edge fades into the background colour (no visible seam)

# (every step is its own `convert`, so ImageMagick's "compose" setting can never leak into the next step)
convert "$SRC" -alpha off -filter Lanczos -resize ${ART}x${ART}! "$TMP/art.png"

# --- foreground: picture with softly faded edges on a transparent 108 dp canvas
convert -size ${ART}x${ART} xc:black -fill white \
  -draw "rectangle $((FEATHER*2)),$((FEATHER*2)) $((ART-FEATHER*2-1)),$((ART-FEATHER*2-1))" -blur 0x$FEATHER -colorspace Gray "$TMP/fade.png"
convert "$TMP/art.png" "$TMP/fade.png" -alpha off -compose CopyOpacity -composite "$TMP/art-faded.png"
convert "$TMP/art-faded.png" -background none -gravity center -extent ${CANVAS}x${CANVAS} "$TMP/fg.png"

# --- monochrome: keep only the near-white parts (crown + name), as white on transparent.
#     Only the band y = 28%..80% / x = 6%..94% is kept, so stray white specks elsewhere in the picture don't show up.
convert "$TMP/art.png" -channel RGB -separate +channel -evaluate-sequence min -level 50%,80% "$TMP/white.png"
convert -size ${ART}x${ART} xc:black -fill white \
  -draw "rectangle $((ART*6/100)),$((ART*28/100)) $((ART*94/100)),$((ART*80/100))" -blur 0x$((ART/160)) -colorspace Gray "$TMP/band.png"
convert "$TMP/white.png" "$TMP/band.png" -compose Multiply -composite "$TMP/white-band.png"
convert -size ${ART}x${ART} xc:white "$TMP/white-band.png" -alpha off -compose CopyOpacity -composite "$TMP/mono-art.png"
convert "$TMP/mono-art.png" -background none -gravity center -extent ${CANVAS}x${CANVAS} "$TMP/mono.png"

# --- every density
for spec in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  d=${spec%%:*}; s=${spec##*:}; f=$((s * 108 / 48))
  out="$RES/mipmap-$d"; mkdir -p "$out"
  convert "$TMP/fg.png"   -filter Lanczos -resize ${f}x${f} -strip "$out/ic_launcher_foreground.png"
  convert "$TMP/mono.png" -filter Lanczos -resize ${f}x${f} -strip "$out/ic_launcher_monochrome.png"
  convert "$SRC" -alpha off -filter Lanczos -resize ${s}x${s} -strip "$out/ic_launcher.png"
  c=$(( (s - 1) / 2 )); inner=$((s * 90 / 100))
  convert "$SRC" -alpha off -filter Lanczos -resize ${inner}x${inner} -background "$BG" -gravity center -extent ${s}x${s} \
    \( -size ${s}x${s} xc:none -fill white -draw "circle $c,$c $c,0" \) -compose DstIn -composite -strip "$out/ic_launcher_round.png"
done

mkdir -p "$RES/values" "$RES/mipmap-anydpi-v26"
cat > "$RES/values/ic_launcher_background.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">$BG</color>
</resources>
EOF
for n in ic_launcher ic_launcher_round; do
cat > "$RES/mipmap-anydpi-v26/$n.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
EOF
done
echo "icons written to $RES"
