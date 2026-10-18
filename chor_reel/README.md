# चोर (Chor): Recreation with a Cosmic Thief and a Buddha House Owner

**Main deliverable: v4:** [`output/chor_cosmic_v4_1920x1080.mp4`](output/chor_cosmic_v4_1920x1080.mp4) is **16:9 widescreen like the original film** (1920×1080, 30 fps, 1,591 frames, H.264 High, 53.14 s). It keeps the original's black cinema bars, which open near the end exactly as in the original. The **original audio** is stream-copied, verified bit-identical to the source.

- **Thief:** a cosmic figure like the original's, a hooded cloak made of a starry night sky with a glowing outline.
- **House owner:** a slim, serene Buddha drawn from scratch. There is no lip movement, as in the original.
- **Opening:** re-cut on the lyric words so it doesn't drag.

See [`docs/v4_scene_breakdown.md`](docs/v4_scene_breakdown.md).

**Earlier versions (superseded):**
- **v3 (vertical 9:16, Buddha):** [`output/chor_buddha_v3_1080x1920.mp4`](output/chor_buddha_v3_1080x1920.mp4); see [`docs/v3_scene_breakdown.md`](docs/v3_scene_breakdown.md).
- **v2 (vertical, Kerala scribe):** [`output/chor_kerala_1080x1920.mp4`](output/chor_kerala_1080x1920.mp4)
- **v1 (draft, composite):** [`output/chor_reel_1080x1920.mp4`](output/chor_reel_1080x1920.mp4)

| Document | Contents |
|---|---|
| [`docs/v4_scene_breakdown.md`](docs/v4_scene_breakdown.md) | v4 scene-by-scene breakdown with timestamps, and the feedback fixes |
| [`docs/v3_scene_breakdown.md`](docs/v3_scene_breakdown.md) | v3 breakdown |
| [`docs/qa_report.md`](docs/qa_report.md) | Checks run on every version, audio verification, known issues |
| [`docs/v2_scene_breakdown.md`](docs/v2_scene_breakdown.md) | v2 breakdown |
| [`docs/shot_list.md`](docs/shot_list.md) | Analysis of the original film and its timestamped shot list |
| [`docs/scene_breakdown.md`](docs/scene_breakdown.md) | What changed in each shot of the v1 vertical version |
| `tools/v4/` | The v4 pipeline (16:9). `v4_main.py a b out.mkv` renders any frame range. It uses the helpers in `tools/v3/` and `tools/v2/`, and `letterbox.json` holds the original's bar heights per frame. |
| `tools/v3/` | The v3 pipeline. `v3_main.py a b out.mkv` renders any frame range losslessly, and `../assemble.sh` muxes the original audio. It uses the helpers in `tools/v2/`. The working directory is given by `CHOR_S`, which holds the sources, the extracted sprites and `fonts/deva2.ttf` (Noto Sans Devanagari). |
| `tools/v2/` | The v2 pipeline and shared helpers |
| `tools/` | The v1 production pipeline (Python + ffmpeg) |

### v3 pipeline (`tools/v3/`)

| Module | Role |
|---|---|
| `v3_beats.py` | Lyric timing (word timestamps from the original audio) and the voice envelope used for lip movement |
| `v3_open.py`, `v3_door.py` | The river and boat opening, and the door push-in with the river, steps and moored boat kept |
| `v3_room.py` | The room set (arched moon window, scales niche, clay lamp) and the starfield |
| `v3_owner.py` | The Buddha: painted cut-out rig (seat, lap, body, robe, head with jaw positions) with arms painted per frame |
| `v3_story.py` | Cameras and cuts, the Buddha's and the thief's performance, lighting, wall shadows, and the starry-dome transition |
| `v3_fx.py` | One effect per lyric line, each timed to its key word and its "ले जा" |
| `v3_final.py`, `v3_main.py` | Ending (star pictures and the original title) and the master frame renderer |

## v1: what was changed

1. **Chor replaced.** The star-cloaked thief is replaced in every shot by the round-bellied character from the supplied Kerala story video (white mundu with gold kasavu border, angavastram, hair bun, ear studs, gold bangles and ring). As requested, he keeps his **original skin and clothing colours**. Only a soft lavender rim and glow (taken from the original Chor's outline colour) and scene-matched rim light tie him into the night palette.
2. **House upgraded.** The plain lakeside block is replaced by a modest, dark-walled cottage. It has a tiled hip roof with a small chimney, a warm amber arched window with a flower box, an arched wooden door under a little awning, a wall lantern, potted plants and a climbing vine. A stone plinth sits on the original platform and steps. It is drawn as flat, stylised layers that match the film's look and is motion-tracked to the original camera move (pan and push-in).
3. **9:16 reframing.** Each shot is recomposed for vertical viewing. Nothing is stretched. The 2.39:1 picture is extended upward and downward with a continuation of the scene: starry sky with a tracked moon halo, lake water with ripples, room walls and floor, or open starfield. The film's own letterbox opening at 45 s is handled the same way.

Everything else is untouched: the narrator, his shadow, all objects and effects, the timing, every cut and dissolve, the title card (चोर / JUSTH), and the **original audio**, which is copied packet-for-packet.

## Pipeline (`tools/`)

| Step | Script |
|---|---|
| Source analysis: metrics, cuts, narration transcript (Whisper) | `analyze.py`, `transcribe.py` |
| Original-Chor masks: outline segmentation for the exterior; keyframe masks plus rigid similarity tracking for the interior and starfield | `seg_outline.py`, `keymask.py`, `keymask_bir.py`, `track_chor.py` |
| House camera track (window and facade template tracking) | `track_ext.py`, `track_house.py`, `house_track_final.py` |
| Character extraction from Asset B: BiRefNet matting, APISR 2× anime super-resolution, edge decontamination, mirroring | `segment.py`, `batch_segment.py`, `sr.py`, `build_char.py`, `build_hand.py` |
| Upgraded house layers | `house.py` |
| Per-frame render: removal, fill, vertical canvas extension, house, character, reflection, dissolve | `reel_common.py`, `reel_render.py`, `reel_char.py` |
| Parallel lossless render, then assembly with the original audio | `render_chunk.py`, `assemble.sh` |
| Verification | `qa_check.py` |

Model weights used (downloaded at run time, not committed): `onnx-community/BiRefNet-ONNX` (matting), `Xenova/2x_APISR_RRDB_GAN_generator-onnx` (super-resolution), and `faster-whisper small` (transcription only).
