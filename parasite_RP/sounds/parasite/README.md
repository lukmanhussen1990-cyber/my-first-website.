# Custom parasite sounds

Every sound plays a custom `pm.*` id **and** a vanilla id, so the mod is audible
straight away. Drop your own Ogg Vorbis files in here using the exact names
below and they layer on top — no other file needs changing.

| File name (add `.ogg`) | Played when                          |
| ---------------------- | ------------------------------------ |
| `spawn`                | a parasite appears                   |
| `screech1`, `screech2` | the shriek right after it spawns     |
| `chew1`–`chew3`        | it is eating blocks or items         |
| `bite`                 | it kills something                   |
| `grow`                 | it grows to the next stage           |
| `split`                | an apex parasite splits in two       |
| `die`                  | it is purged or killed               |
| `sample_use`           | the Parasite Sample releases one     |
| `purge`                | a purge is triggered                 |

Format: Ogg Vorbis, 44.1 kHz, keep each file small so phones do not stutter.
To use only your own audio, delete the `vanilla:` entries in
`scripts/sounds.js` in the behavior pack.
