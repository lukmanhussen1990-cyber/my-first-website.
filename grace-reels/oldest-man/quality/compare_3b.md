# Quality loop 3b — verse card after the 3a fixes (Genesis 5:24, S3, frame 469 / 15.63 s)

`compare_3b.png`: left = the same reference card frame (refB_055), right = ours after both loops (v3).
The v2 state, after the 3a fixes and before the 3b fixes, is kept at `build/q/compare_3b_v2.png`.

## The 3a fixes (v1 → v2), all done
- Verse is 62 px italic on a 740 px measure (3 lines). The card is now card-shaped, not a banner.
- `GOD TOOK HIM.` is in deep antique-gold ink `#87500a` (about 6:1 on the cream), in 0.9× serif caps with a light emboss.
  The gold run is "glued" in the layout, so it never splits across lines; here it lands as its own payoff line.
  A thin brush underline draws along the run as it is spoken.
- The verse has typographic “ ” quotes.
- Clean warm cream paper: the fibre texture is at 55 % multiply with fewer specks, 16 px radius, one gold-foil hairline
  frame, corner flourishes, warm top light and an aged inner edge. The ragged deckle and the double rule are gone.
- The card sits at top 356 px, clear of the header. The backdrop darkening is now 22–34 % and centred on the card,
  so the scene keeps its light. The reference line is darker gold-brown `#7a4a12` at 21 px.

## Still weaker than the ref in v2 (found on compare_3b_v2) → fixed in v3
1. **Closing quote turned gold** with the last gold word (`HIM.”`). The ref keeps punctuation in ink.
   → the closing quote is rendered as its own span in ink.
2. **Static tilt read as skew in a still.** rotateY −2° and rotateZ −0.4° turned the card into a trapezoid; the ref is
   square. → rotateY −0.6° ± 0.5 and rotateZ −0.15° ± 0.25. The float, the landing tilt and the glint stay.
3. **Underline crowded the reference line** (about 14 px of air). → 40 px gap between the verse and `GENESIS 5:24 · KJV`.
4. **Watermark quote read as a smudge** next to the top-left corner flourish. → removed.
5. **Frame furniture competed with the verse at phone size** (1.3 px frame at 55 %, corners at 75 %). The ref is calmer.
   → 1 px hairline at 42 %, corners at 55 %. The verse is the clear hero.

## Remaining honest gaps (not fixable on the card itself)
- The ref card sits over a finished, bright 3D scene. Ours is still over placeholder boxes until the world track lands.
- Ref verses reveal as a whole; ours do karaoke. That is a deliberate upgrade, but the unspoken words are ghosted at 26 %
  ink, so a viewer who pauses mid-verse sees a partly ghosted card.
