# Horizon Glow Graphics — resource-pack graphics add-on for Minecraft Bedrock 1.21.0.26 (Android)

Built for the game version shown on your title screen: **Minecraft Bedrock beta 1.21.0.26** (renderer: RenderDragon / OpenGL ES; device: realme RMX3612, Mali-G57 MC2).
It is a normal `.mcaddon` / `.mcpack` — no root, no launcher, no experimental toggles. It gives a shader-*like* look (haze, glowing sun, soft clouds, clear water, richer colour).

> **Read this first**
> * It is a **resource pack, not a real shader**: no dynamic shadows, no reflections (as far as I can tell, a normal add-on cannot add those on this game version — see *Honest limits*).
> * It has **not been tested on a phone yet** — there was no device in the build environment. The files were checked by scripts and by separate AI review passes, never run in the game.
> * It is made for **1.21.0.x only**. After a bigger game update some parts may stop working.

## Download

Tap **one** of these links on your phone (the repository is public, so no login is needed; the links download the file directly). If the repository is ever made private these links stop working, so download first.

* **Recommended – graphics + optional Ambient FX (`.mcaddon`):** <https://raw.githubusercontent.com/lukmanhussen1990-cyber/my-first-website./claude/minecraft-mobile-graphics-mod-kov7rd/minecraft-graphics-mod/dist/HorizonGlow_Graphics_and_AmbientFX_1.21.0.mcaddon> — importing it changes nothing until you activate a pack, so you decide later whether to use the extra.
* Graphics only (`.mcaddon`; pick this if you want nothing that touches the player file): <https://raw.githubusercontent.com/lukmanhussen1990-cyber/my-first-website./claude/minecraft-mobile-graphics-mod-kov7rd/minecraft-graphics-mod/dist/HorizonGlow_Graphics_1.21.0.mcaddon>
* Graphics only as `.mcpack` (if your phone refuses `.mcaddon`): <https://raw.githubusercontent.com/lukmanhussen1990-cyber/my-first-website./claude/minecraft-mobile-graphics-mod-kov7rd/minecraft-graphics-mod/dist/HorizonGlow_Graphics_1.21.0.mcpack>
* Ambient FX on its own (`.mcpack`, optional extra – see below): <https://raw.githubusercontent.com/lukmanhussen1990-cyber/my-first-website./claude/minecraft-mobile-graphics-mod-kov7rd/minecraft-graphics-mod/dist/HorizonGlow_AmbientFX_OPTIONAL_1.21.0.x.mcpack>

Take **one of the first three**: they contain the same graphics pack, and importing a second copy can show a "duplicate pack" message. The Ambient FX extra is already inside the recommended file.
The links point at the branch `claude/minecraft-mobile-graphics-mod-kov7rd` (it has not been merged into `main`); the same files are in the `dist/` folder of that branch.

## Install

1. **Import.** Tap the finished download (or open *Files → Downloads* and tap the file) and choose **Minecraft** if Android asks which app to use. Minecraft opens and reports that the import started / succeeded.
   * If the file name ends in `.zip` (for example `….mcaddon.zip`), long-press it → *Rename* → delete the `.zip`, then tap it again. No *Rename* option? Use the `.mcpack` link instead.
   * "Import failed"? The download was probably cut off — download it again.
   * If Minecraft says the pack is a duplicate, an older copy is already installed: delete it first (*Settings → Storage → Resource Packs →* select it *→ trash icon*; menu names can differ slightly between versions) and import again.
2. **Activate.** In Minecraft: *Settings → Global Resources → My Packs → Horizon Glow Graphics → Activate.*
   "Global" applies to every world; you can also activate packs for one world only (*Edit world → Resource Packs*).
   *Optional extra:* if you imported the full add-on you can also activate **Horizon Glow Ambient FX** (fireflies, dust, plankton). It is independent of the graphics pack — if your character ever looks odd, deactivate it.
3. **Pick a preset.** Tap the gear / settings icon on the active pack and move the slider to *Lite*, *Standard* or *Ultra*. Your phone should default to **Ultra**.
   **After changing the preset, fully close Minecraft (open the recent-apps screen and swipe Minecraft away) and open it again** — the game may only read the fog, water and HUD files when it starts.
4. **Recommended video settings** (*Settings → Video*, where your version has them): render distance 10–12, Fancy graphics ON, Beautiful skies ON, Smooth lighting ON, Fancy leaves ON, Render clouds ON.

### How to tell it is working (30-second check)

Load any world in daylight and look at the horizon. You should see:
1. **Sun** – a bright round sun with a soft glow (vanilla is a hard yellow square).
2. **Clouds** – fluffy banks with clear gaps instead of fine speckle.
3. **Distance** – far hills fade into a coloured haze instead of cutting off abruptly.
4. **Water** – clearer and more saturated, with soft ripples and tiny sun glints.
5. **Ultra only** – the screen corners are slightly darker (a vignette drawn *behind* the buttons, so the HUD stays crisp).

At night: a round moon with 8 phases (and fireflies if you activated the Ambient FX pack).
If nothing looks different, see *Troubleshooting*.

## Presets (the slider on the pack's gear icon)

| Preset | Look |
| --- | --- |
| **Lite** | Subtle: light haze, slightly richer grass/leaf/water colours, clearer water |
| **Standard** | Balanced distance haze, vivid grass/leaves/water, soft clouds |
| **Ultra** *(default on most phones)* | Strongest per-biome haze, most vivid grass/leaf/water colours, fluffier clouds, dark-corner vignette |

All three presets use the **same** re-graded block, item and mob textures; the presets differ in haze, grass/leaf/water colours, cloud style and the vignette.
Nothing here adds shaders or bigger textures, so the frame rate should stay close to vanilla — I could not measure it. Ultra adds one full-screen overlay, so if anything ever lags, that is the first thing to switch off (pick *Standard*). Still laggy? Lower the render distance to 8 and turn *Fancy leaves* off. If the haze feels too strong, pick *Standard* or *Lite*, or raise the render distance.

## Optional: Ambient FX pack

Adds **fireflies at night, drifting sunlit dust by day and plankton underwater** — plain vanilla particles, no scripting, at most about 60 tiny particles around you (and only one of the three kinds at a time).
They are switched on by the game clock and your height, not by the dimension, so a few may also drift around you in the Nether or the End.

It is a *separate* pack because, to emit particles around the camera, it has to replace Mojang's client file for the player (`entity/player.entity.json`; the only change is three small additions — see `tools/gen_ambient.py`). That file belongs to the game version it was copied from, so **use it on 1.21.0.x only** and remove it after a game update. Activate it *in addition to* Horizon Glow. If you also use another pack that changes the player model or animations (it replaces the same file), only one of the two can take effect.

## Troubleshooting

* **Nothing changed** → *Settings → Global Resources*: make sure *Horizon Glow Graphics* is in the **Active** list and move it to the top (use the up/down arrows next to the pack, or drag it, depending on your version).
* **The pack is not in the list** → look under *My Packs* (it only moves to *Active* after you tap *Activate*). Not there? Swipe Minecraft away, open it again, and if it is still missing download and import the file again.
* **Sky, clouds and colours changed, but no haze or water change** → the fog/water part is the least certain one (it is the part that depends most on the exact game version). Note which preset you picked and pass it back to whoever builds the next version.
* **Preset change had no effect** → swipe Minecraft away (force-close) and open it again.
* **Grass, leaves, water or haze look too strong** → pick *Standard* or *Lite* with the gear icon (the block/item textures are the same in all presets).
* **Other resource packs** → anything above Horizon Glow in the *Active* list wins; keep other texture packs *below* it if you want both.
* **No vignette** → it only exists in the *Ultra* preset.

## Uninstall

*Settings → Global Resources →* *Active* → tap *Horizon Glow …* → **Deactivate** (do the same for *Ambient FX*). If you also activated a pack for a single world, deactivate it there too (*Edit world → Resource Packs*). To delete a pack completely, use *Settings → Storage → Resource Packs →* select it *→ trash icon* (menu names can differ slightly between versions). The pack never changes your world data, so removing it restores the vanilla look instantly.

## What it changes

![Generated assets: sun, moon phases, clouds, water, colour maps, haze/water palette, graded textures](docs/asset_preview.png)
*The assets the pack ships (an asset sheet, not an in-game screenshot).*

* **Atmosphere** – 91 biome fog definitions per preset: distant terrain fades into a coloured horizon haze (warm over desert/savanna, teal over jungle, pale blue on snow, murky green in swamps, pink over cherry groves); cave biomes (lush / dripstone / deep dark) only get tuned water colour. Rain gets a brighter, bluer overcast. Nether fog is pushed out so it is readable on a phone; the End gets a faint violet haze.
* **Water** – every biome has its own clear, saturated water colour and lower opacity; swamps stay murky. New animated water with soft ripples and sun glints (loops seamlessly), re-authored flowing water.
* **Sky** – round, glowing sun with bloom; smooth moon with 8 correct phases; new cloud pattern (fluffy banks with gaps instead of speckle); brighter, more visible rain.
* **Colour** – grass, leaves, birch/spruce and swamp colour maps re-graded in a perceptual colour space ("vibrance": dull colours gain more than already vivid ones, so nothing goes neon). The grass-block side fringe uses the same grade so tops and sides match.
* **Textures** – ~2,150 textures (about 1,060 block, 640 item, 450 mob/creature and 10 worn-armour textures, plus the flame and particle sprites) get one consistent film grade (vibrance, gentle S-curve, warm highlights / cool shadows), baked relief lighting on opaque blocks (more depth), glints on ore flecks, brighter light sources (glowstone, lanterns, froglights, lava, …) and stronger contrast in leaves. Technical textures and pure-grey tint masks (banners, shields, dyes, redstone dust, command blocks, structure blocks…) are left exactly as they are. File names, sizes and formats are identical to vanilla, so nothing else is touched.
* **Ultra only** – a soft vignette image drawn *behind* the HUD for a filmic frame.

## Honest limits (please read)

* This is **not** a "RenderDragon shader". Real shader packs (dynamic shadows, screen-space reflections, volumetric light, waving water) replace the game's compiled `.material.bin` files. As far as I can determine, Minecraft 1.21.0.26 on Android does not load those from an ordinary resource pack (people use patched games or launchers for that), and the official shader system (deferred lighting / "Vibrant Visuals") only arrived in later game versions. Treat any download that promises shadows and reflections from a plain `.mcaddon` on the Play Store version with suspicion.
* So this pack uses **everything a normal add-on can legitimately change** — fog, water, sky bodies, clouds, weather, colour maps, textures, HUD — and tunes it together for the closest shader-like feel that should cost little or no frame rate.
* Not included on purpose: dynamic torch light. It needs a behavior pack with scripts that place invisible light blocks in your world, and I had no way to test that, so I did not ship it.
* **Made for 1.21.0.x.** Mojang later moved per-biome fog/water settings from `biomes_client.json` to newer `client_biome` files (the built-in packs stop using the old file from 1.21.40) and introduced Vibrant Visuals. After a big game update, the per-biome fog/water part of this pack may stop applying (the textures, sky, clouds and colour maps keep working). To stay on this version, turn off auto-update for Minecraft in Google Play (the ⋮ menu on the Minecraft page); after an update, ask for a rebuilt pack (the generator is in `tools/`).
* The sky *dome* colour (the blue overhead) is computed by the game from biome temperature and cannot be changed by packs in this version; the pack colours the **horizon haze** instead.
* **Nothing was tested in the game.** I checked the files against Mojang's own 1.21.0.26 data files and documentation with an automated validator (`tools/validate.py`) and several separate AI review passes, but I never ran Minecraft. If something looks wrong, note the preset and what you see (a screenshot helps) and pass it back to whoever builds the next version.

## Legal

Fan-made, non-commercial, not affiliated with Mojang or Microsoft.
About 2,150 textures in the pack are **modified derivatives of Minecraft's own textures** (© Mojang AB — a colour grade and baked lighting, nothing redrawn), plus one modified copy of the player's client entity file in the optional Ambient FX pack. The fog definitions and colour maps are likewise built on Mojang's biome data and files, and the rain sprite is a tweaked Mojang sprite. That makes this pack **personal-use only**: do not sell it, and read the Minecraft Usage Guidelines before sharing it publicly. This repository is currently **public** — if you would rather not redistribute Mojang-derived textures, download the pack first and then switch the repository to private (GitHub → Settings → Danger zone → Change visibility; the download links stop working once it is private). Only the sun, moon, clouds, animated water, vignette, particles and the generator scripts were created from scratch for this project.

## Rebuilding / developers

```
git clone --depth 1 --branch v1.21.0.26-preview https://github.com/Mojang/bedrock-samples.git /tmp/bedrock-samples
python3 -I tools/build.py    --vanilla /tmp/bedrock-samples/resource_pack   # regenerates pack/ and dist/ (byte-identical on every run)
python3 -I tools/validate.py --vanilla /tmp/bedrock-samples/resource_pack   # static checks (json, sizes vs vanilla, fog ids, zips)
python3 -I tools/selftest.py                                               # colour-code self test
```

Python 3 + Pillow + numpy only. `WORKLOG.md` has the build timeline; `docs/asset_preview.png` is generated by `tools/make_preview.py` (an asset sheet, not an in-game screenshot).
