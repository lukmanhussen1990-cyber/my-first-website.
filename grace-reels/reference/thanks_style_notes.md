# Style notes: `thanks_style.mp4`

I pulled 2 frames per second with ffmpeg (90 frames, 0–45 s) and some extra
close-ups of the first 2 s at 6 fps. The reference is 1920×1080, 30 fps, about 45 s long.

**We copy the motion language only.** We do not copy the brand name, logo, UI
screens, copy or the anatomy/doctor imagery. Everything in our video is drawn
in code in our own palette.

---

## 1. Opening: sparkle star → cloud mask (0.0–2.0 s)

- **Background:** a flat, very dark navy. There is no texture yet, only empty space.
- **Sparkle:** a small four-point star with concave sides (an "astroid"
  shape), centered. It **grows from nothing** (0.0–0.5 s) while **turning
  slowly** (about a quarter turn). It does not pop. Its scale eases out.
- **Burst into a mask (0.5–0.7 s):** a small **round, soft-edged blob**
  appears behind the star. It already shows the cloud footage inside it, and the
  star sits on top, slightly washed out.
- **Organic "cloud" mask (0.7–1.6 s):** the blob grows very fast at first and
  then slows down (strong ease-out). Its edge is **scalloped**, like a cartoon
  cloud: about 12–16 soft bumps around a circle. The edge is **feathered**
  (2–4 px of blur at 1080p), not hard. The bumps change shape a little as the mask grows.
  It overshoots the frame and fills it completely by about 1.6 s.
- **Star colour flip:** once the bright sky is behind it, the star turns
  **dark** (it reads as a dark cut-out) and keeps spinning. Then it **shrinks
  away** (1.3–1.9 s), still turning, and disappears into the clouds.
- **The revealed world:** a sea of clouds seen from above, with the horizon about 25–30 %
  down from the top, and a soft, hazy, bright sky. Moody, not saturated.

## 2. Frosted-glass UI (2.0–8.0 s)

- **Glass button:** a small **circle of frosted glass** fades in where the
  star was. It holds a thin **"+"** glyph that rotates in from an "×"
  (2.0–2.5 s). A second glass circle with a **send (paper-plane)** icon
  slides out of the first one to its right (2.5–3.0 s).
- **Glass recipe:** the clouds behind the glass are **blurred** (backdrop blur), with a
  very slight light tint, a **1 px bright rim** (brighter on top, fading on the
  sides), a soft inner highlight and almost no drop shadow on a light
  background. Thin white line icons.
- **Pill expansion (3.5–4.0 s):** the two circles **merge and stretch into a
  long pill** (search bar): "+" at the left, mic and a solid send button
  at the right. The width eases out smoothly, and the content fades in after the
  shape settles.
- **Typing:** placeholder text **types in letter by letter** with a thin
  blinking caret. It then cycles through several prompts. Each new prompt
  replaces the last with a quick blur-out/blur-in, not a cut.
- **Headline above the pill:** words **blur in one at a time** (a strong
  Gaussian blur goes to sharp while opacity rises). A **colour sweep** runs left to
  right: the last words are still lavender/tinted while the first are already
  white. Then the whole line settles to white.
- **Camera:** the clouds keep drifting slowly the whole time. The UI floats up
  in the frame (5.5–7.0 s), so it feels like the camera tilts down.
- **Card from the pill (7.5–8.0 s):** the pill grows into a **large
  glass card** that fills most of the frame. Text types inside it.

## 3. Words on soft gradient blobs (8.5–11.5 s, 15–17 s, 24–28 s, 39–42 s)

- **Background:** near-black with **2–3 large, very soft glowing blobs**
  (violet/indigo radial gradients, blurred far out of focus) that **drift
  slowly**. Blobs often sit low in the frame, like a glow coming from below.
- **Words:** centered, medium-weight sans serif. Each word **blurs in**
  (about 20–30 px blur → 0, with opacity 0 → 1 and a small rise and scale-down) with a
  slight stagger between words. Keywords get a **gradient colour sweep**
  (lavender → white, or the other way). On the way out, words **blur out**
  rather than fade. Characters can scatter-blur (some letters resolve
  before others: "alyz ng he f ecte a ea..").
- **Text glow:** the hero words have a soft outer glow (bloom) in the accent
  colour.

## 4. Depth and transitions

- **No hard cuts anywhere.** Scene changes are made with masks (the cloud blob, a
  vertical wipe that is soft on one edge), cross-blurs (one layer blurs out
  while the next blurs in), or a layer growing to fill the frame.
- **Glass cards in 3D:** UI cards tilt in perspective and drift (a slow
  rotateX/rotateY of a few degrees), with depth of field: the far edges are softer.
- **Motion blur** shows only on fast moves: a card flying in, a fast scroll, a
  vertical slide. Slow moves are crisp.
- **Easing:** everything uses strong ease-out (fast start, long soft landing).
  Nothing moves at a constant speed, and nothing bounces.
- **Slow constant push:** backgrounds keep drifting or scaling slowly even
  when nothing else moves, so the frame never feels static.

## 5. Ending: wordmark (41.5–45 s)

- The last line of text blurs out. The **wordmark appears big and centered** with
  a soft **gradient fill** and a faint **glow**. The background glow blobs
  sink and fade to pure black. The wordmark then holds still and clean for
  about 2 s. It keeps a very slight glow and has no other motion.

---

## How we use this in GRACE IN MOTION · 1K Thank-You (5 s)

| Reference move | Our version |
| --- | --- |
| Four-point sparkle, grow + quarter turn | Gold sparkle with soft amber glow, a quarter turn and two pulses |
| Scalloped cloud mask reveal | Noise-driven wobbly blob mask (the bumps drift) revealing a **shader** golden-sunrise cloud sea |
| Star flips dark and shrinks into the clouds | Same: the star turns to ink, then shrinks away, still spinning |
| Glass "+" circle that stretches into a pill | Glass "+" circle rises from below and stretches into a counter pill |
| Typing text with caret | Odometer counter with motion blur (our "typing" moment) |
| Word-by-word blur-in + colour sweep | "THANK YOU" in Cormorant Garamond, blur 30 → 0 px, with a gold light sweep |
| Glowing gradient blobs | Warm amber/deep-gold blobs on warm black |
| Big wordmark with glow at the end | Gold cross logo draws itself, then GRACE IN MOTION + handle + Philippians 1:3 |

Palette used: warm black `#0E0B09`, ink `#1E1A16`, cream `#F3ECDF`, gold
`#F2B544`, deep gold `#9A5B0C`, soft amber glow `#FFD27A`.
