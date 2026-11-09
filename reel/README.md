# "Baby Wins Again" — 9:16 Instagram reel made in Blender

Semi-realistic MakeHuman characters in a simple bright living room, deadpan voiceover,
big white word-synced captions, a fast cut every ~2 seconds, and stiff character motion,
matching the style of `reference/reference.mp4`.

* Output: `final_reel.mp4`, 1080×1920, 30 fps, H.264 + AAC, **55.5 s** (the length of the
  supplied voiceover; the last 1.4 s is the freeze frame).
* Renderer: Blender 4.5 LTS, EEVEE.

## Run it again

```bash
python3 make_reel.py setup     # once: Blender 4.5 LTS + MPFB2 + every free asset (~2.5 GB)
python3 make_reel.py preview   # 1 quick frame per shot -> render/previews.jpg
python3 make_reel.py render    # all frames -> render/frames/ (resumable; --scale 67 = faster)
python3 make_reel.py finish    # sound mix + captions + encode -> final_reel.mp4
```

Files:

| file | what it does |
|---|---|
| `make_reel.py` | the one script to run |
| `scripts/build.py` | builds the room, characters, props, lights, camera in Blender and renders |
| `scripts/shots.py` | the 27 shots: camera moves, poses, faces, timings |
| `scripts/timeline.py` | shot times + sound-effect cue times (seconds in the voiceover) |
| `scripts/mh.py` | MPFB2 helpers (create human, apply BVH pose, face expressions, recolor clothes) |
| `scripts/fetch_assets.py` | downloads every asset listed below |
| `scripts/transcribe.py` | word timestamps of the voiceover (faster-whisper, local) |
| `scripts/captions.py` | 2–3 word captions, Poppins ExtraBold, white + dark outline/shadow, middle of the screen |
| `scripts/audio.py` | mixes voiceover, sound effects and music |

### Swap in your own sounds
Freesound and Pixabay block automated downloads, so the **gasp, police siren and fart** are
simple synthesized stand-ins for now. Download CC0 versions you like and save them as:

```
audio/sfx/gasp.mp3     e.g. https://pixabay.com/sound-effects/search/gasp/
audio/sfx/siren.mp3    e.g. https://pixabay.com/sound-effects/search/police%20siren/
audio/sfx/fart.mp3     e.g. https://pixabay.com/sound-effects/search/fart/
audio/sfx/music.mp3    (optional) e.g. https://pixabay.com/music/search/funny/
```
then run `python3 make_reel.py finish`. No re-render needed.

### Mixamo animations (optional)
Put Mixamo FBX files in `animations/` to have them retargeted. Right now the characters use
MPFB2/MakeHuman BVH poses plus simple keyframes, which gives the stiff look of the reference.

## Assets used (all free)

**Characters: MPFB2 / MakeHuman** (https://github.com/makehumancommunity/mpfb2, GPL add-on; assets
from https://static.makehumancommunity.org/assets/assetpacks/)
* `makehuman_system_assets` (CC0): skins, eyes, eyebrows, hair (`short02`, `short04`),
  clothes `male_casualsuit06` (white tee + jeans), `female_casualsuit02` (Mom: tee + denim shorts), shoes
* `hair02` (CC-BY, Elvaerwyn): `elvs_island_princess_hair` (Mom: long black hair with a pink bow)
* `skins01` (CC0, MargaretToigo): `toigo_light_skin_with_natural_makeup` (Mom)
* `hats03` (CC-BY, Mindfront): `mindfront_patrol_cap` (police cap)
* `shirts02` (CC-BY, Elvaerwyn): `elvs_male_shirt_tie_tucked1` (police shirt, recolored navy)
* `pants02` (CC-BY, Elvaerwyn): `elvs_male_trouser` (police trousers)
* `underwear02`: `elvs_crude_bootyshorts` (CC-BY, Elvaerwyn) recolored white as the baby's diaper
* poses (CC0): `makehuman_system_poses`, `poses01/03/04/05` (callharvey3d, culturalibre, drednicolson,
  elvs, sohh, jjones, gpedroso, punkduck, standing0x, run01)
* `faceunits01` (CC0, Mika Suominen): ARKit face shapes (smile, wink, gasp)

**Room, furniture, textures, sky: Poly Haven** (CC0, https://polyhaven.com)
sofa_02, ArmChair_01, modern_coffee_table_01, television_02, modern_wooden_cabinet, potted_plant_01/02,
hanging_picture_frame_01/02, throw_pillows_01, rubber_duck_toy, side_table_01, wall_clock,
wooden_bookshelf_worn; textures wood_floor, painted_plaster_wall,
rough_pine_door; HDRI kloofendal_48d_partly_cloudy_puresky.

**Sound: Kenney** (CC0, https://kenney.nl): Impact Sounds, Interface Sounds, RPG Audio, Music Jingles
(pizzicato bed).

**Fonts:** Poppins ExtraBold (OFL, Google Fonts), DejaVu Sans (hearts / sparkles glyphs).

**Made here (tiny props only):** the poop swirl, the wall sign, the held diaper, the door slab
(textured with Poly Haven's door texture) and the room's wall/floor planes.

### Attribution needed for the CC-BY clothes
Put this in the post description:
`3D clothing: Elvaerwyn & Mindfront (MakeHuman community, CC-BY). Assets: Poly Haven, Kenney (CC0).`
