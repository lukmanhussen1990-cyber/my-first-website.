# Custom sounds

Every disaster plays **two** sound ids at the same time:

1. a custom id (`nd.tornado.loop`, `nd.meteor.impact`, ...) defined in
   `../sound_definitions.json`, which points at the `.ogg` files in this folder;
2. a vanilla id (`mob.enderdragon.flap`, `random.explode`, ...) as a safety net.

That means the addon is **audible out of the box** even though this folder ships
without audio files (binary audio cannot be generated as source code). Drop your
own `.ogg` files in here with the exact names below and they layer on top —
no other file needs to change.

| File name (add `.ogg`)   | Played when                                   |
| ------------------------ | --------------------------------------------- |
| `wand_open`              | the Disaster Wand menu opens                   |
| `wand_cast`              | a disaster is started from the wand            |
| `detector_tick`          | detector countdown beep                        |
| `detector_alarm`         | detector alarm while a disaster is nearby      |
| `warning_siren`          | public warning before a random disaster        |
| `tornado_loop`           | tornado ambience, every second                 |
| `tornado_debris1/2`      | the funnel rips a block out of the ground      |
| `earthquake_rumble`      | earthquake ambience, every second              |
| `earthquake_crack1/2`    | a fissure opens                                |
| `meteor_fly`             | meteor falling                                 |
| `meteor_impact`          | meteor explosion                               |
| `tsunami_roar`           | tsunami ambience                               |
| `tsunami_splash1/2`      | the wave crest rolls forward                   |
| `wildfire_burn`          | wildfire ambience                              |
| `wildfire_ignite`        | the wildfire starts                            |
| `storm_thunder1/2`       | a lightning bolt lands                         |
| `storm_charge`           | the lightning storm begins                     |

Requirements for the files:

- format: **Ogg Vorbis** (`.ogg`), mono or stereo, 44.1 kHz
- keep looping ambiences under ~10 seconds so they stay small on phones
- no file may be larger than a couple of MB or older devices will stutter

To use *only* your own sounds, open `scripts/sounds.js` in the behavior pack and
delete the `vanilla:` entries.
