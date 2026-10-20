# Secret Tunnel — Instagram Reel

Vertical 9:16 reel (1080×1920, 24 fps, ~56.6 s, H.264 + AAC): digging a secret
tunnel under the boundary wall to your best friend's house, one step at a time,
as a stylized 3D cutaway diorama, with a funny ending. Same renderer and look
as [`../underground-garage-reel`](../underground-garage-reel).

## How it is made

| Part | How |
| --- | --- |
| 3D animation | [three.js](https://threejs.org) scene in headless Chromium (SwiftShader WebGL2), accumulated over several sub-frames (sub-pixel jitter, soft sun, occluded sky light, motion blur), then bloom and an AgX grade. |
| The tunnel | [`src/world.js`](src/world.js) describes the cavity as a *dig-time field* over the cut face: every point knows when the dig front reaches it. The soil face, the tunnel's back wall, floors and dig faces all read the same field (a half-float texture), so the hole grows identically everywhere and the brick-arch hollows open as the dirt falls. |
| Timing | [`src/timeline.js`](src/timeline.js) is the single source of truth: voiceover sentence placement, every animation event and every sound cue. |
| Voiceover | ElevenLabs TTS, model `eleven_v4`: narrator "Holden – Warm Midwest Narrator"; the boy's "Hi, Aunty..." is "Adik M – Playful Cartoon Character", pitched up 2.5 semitones with rubberband for a younger voice. |
| Captions | One word at a time, a little above the middle, Fredoka Bold white with a thick black outline and a soft shadow, each word popping in with a tiny bounce; "HI, AUNTY..." last, yellow and bigger. Word times from faster-whisper refined against the audio's silences. |
| Sound | Synthesised effects (digging thuds, concrete clunk, brick clacks, candle fizz, whooshes, switch clicks, rail rattle, wooden lid knocks…) plus recorded crumbling dirt and pops; light pizzicato/marimba music composed in code that stops dead right before "Hi, Aunty...". Voice-ducked mix at −14 LUFS. |

### Scenes

1. Dirt pops out of the left lawn, a shaft goes straight down, a tunnel heads sideways for the wall; the dirt pile grows.
2. *Clunk* — the concrete footing. The tunnel dips under it and climbs back up under the friend's lawn; a grass-topped hatch with a flower pot drops on top.
3. Dirt falls from the roof; red bricks fly in one by one and snap into arches; orange dots show the soil's weight running round the arches and down into the sides.
4. A candle flickers out as the air goes stale; an air pipe pops up through the lawn; blue fresh-air dots flow in, the grey air flows out of the shaft.
5. Pitch dark; a wire runs along the arches and warm bulbs switch on one by one.
6. A snail takes forever; tiny rails snap onto the floor; a red mine cart drops in and zooms through the dip with a cricket bat.
7. Wide shot of the glowing tunnel; Aunty (modern clothes, arms crossed, flip-flop in hand) waits by the hatch; push-in; the hatch flips open, the boy pops his head out grinning, looks up, "Hi, Aunty...", sinks back and the lid slams. A girl watches in shock from the friend's upstairs window.

## Rebuild

```bash
npm install                      # three.js
pip install numpy scipy soundfile pillow faster-whisper
PY=python3 SPP=8 JOBS=2 ./make_reel.sh
```

Quick looks: `node render.mjs stills 6.4,21,53.9 --spp 4` (PNG stills).

The voiceover takes (`assets/vo/`) and their word timings were produced once with
`tools/align_vo.py` + `tools/refine_words.py` and are committed; `build/` is
scratch output and is not.

Font: [Fredoka](https://fonts.google.com/specimen/Fredoka) (SIL Open Font License 1.1).
