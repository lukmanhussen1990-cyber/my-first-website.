# my-first-website.

## Beautiful Base — Minecraft Bedrock house add-on

A one-command survival base for Minecraft Bedrock (Android, iOS, Windows, console).

**Download:** [`BeautifulBase.mcaddon`](BeautifulBase.mcaddon) — tap it on your phone and Minecraft imports it.

### Install

1. Download `BeautifulBase.mcaddon`. Chrome may warn about the file type — choose **Download anyway**.
2. Tap the file. Minecraft opens and shows *Successfully imported*.
3. Create or edit a world and turn on **Activate Cheats**.
4. Under **Behavior Packs**, activate **Beautiful Base**.
5. Enter the world, stand on flat ground, and run one of the commands below.

### Commands

| Command | Builds |
| --- | --- |
| `/function beautiful_base` | Oakwood Cottage, 13×11, two floors |
| `/function base_cottage` | Oakwood Cottage, 11×9, single floor |
| `/function base_manor` | Stonebrick Manor, 17×13, two floors |
| `/function base_lodge` | Darkwood Lodge, 13×11, two floors |
| `/function clear_base` | Erases a base built from that same spot |

Every house comes furnished: beds, chests, barrel, furnace, smoker, blast furnace,
crafting table, bookshelves, enchanting table, brewing stand and anvil, plus lantern
lighting, a chimney with a lit campfire, a fenced garden with a path, and a wheat and
carrot farm with its own water channel.

The build is placed a few blocks north of where you stand and always faces the same
way — Minecraft functions cannot read which direction you are looking.

### Designing your own

Open [`minecraft-house-generator.html`](minecraft-house-generator.html) in a browser to
pick a style, size and features, preview the result in 3D, and export your own
`.mcpack`. Everything runs locally in the page.

### Rebuilding the add-on

```sh
node tools/build-mcaddon.js
```

The build script reads the generator straight out of the HTML page, so the page and
the shipped add-on can never drift apart.
