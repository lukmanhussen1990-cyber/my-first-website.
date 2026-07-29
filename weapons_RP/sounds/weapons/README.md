# Custom weapon sounds

Every weapon plays a custom `wm.*` id **and** a vanilla id, so the pack is
audible out of the box. Drop your own Ogg Vorbis files here with the exact names
below and they layer on top — nothing else needs changing.

| File name (add `.ogg`)          | Played when                          |
| ------------------------------- | ------------------------------------ |
| `thunder_cast`                  | Thunder Blade calls lightning        |
| `thunder_arc1`, `thunder_arc2`  | lightning arcs to another target     |
| `frost_cast`                    | Frost Nova goes off                  |
| `frost_hit1`, `frost_hit2`      | a chilled melee hit lands            |
| `inferno_shot`                  | the Inferno Cannon fires             |
| `inferno_blast`                 | the fire bolt explodes               |
| `void_blink`                    | the Void Ripper teleports you        |
| `void_hit`                      | a lifesteal hit lands                |
| `quake_slam`                    | Earthshaker's Ground Slam            |
| `quake_rumble`                  | the low rumble under the slam        |
| `singularity_open`              | a black hole opens                   |
| `singularity_pull`              | while it is dragging things in       |
| `singularity_implode`           | it collapses                         |
| `denied`                        | an ability is still on cooldown      |
| `codex`                         | the codex screen opens               |

Format: Ogg Vorbis, 44.1 kHz, keep the files small for phones. To use only your
own audio, delete the `vanilla:` entries in `scripts/sounds.js`.
