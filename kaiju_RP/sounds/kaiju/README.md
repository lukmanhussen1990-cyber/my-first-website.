# Custom kaiju sounds

Every sound plays a custom `kj.*` id **and** a vanilla id, so the mod is audible
straight away. Drop your own Ogg Vorbis files in here with the exact names below
and they layer on top — nothing else needs changing.

| File name (add `.ogg`) | Played when                              |
| ---------------------- | ---------------------------------------- |
| `roar1`, `roar2`       | the roar attack, and when one wakes up    |
| `screech`              | it enrages below half health              |
| `step1`, `step2`       | every footfall                            |
| `stomp`                | the shockwave under a footfall            |
| `smash1`–`smash3`      | it grinds buildings and terrain to bits   |
| `tail_sweep`           | the tail sweep                            |
| `atomic_charge`        | the breath charging up                    |
| `atomic_beam`          | the beam firing                           |
| `atomic_hit`           | the beam detonating at the far end        |
| `hurt1`, `hurt2`       | it takes damage                           |
| `death`                | it dies                                   |
| `horn_summon`          | the Kaiju Horn wakes one                  |
| `horn_open`            | the horn menu opens                       |

Format: Ogg Vorbis, 44.1 kHz. Keep the looping ones short so phones do not
stutter. To use only your own audio, delete the `vanilla:` entries in
`scripts/sounds.js` in the behavior pack.
