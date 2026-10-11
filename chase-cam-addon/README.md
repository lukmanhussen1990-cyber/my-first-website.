# Chase Cam (Minecraft Bedrock add-on)

A Sonic Adventure 2 style **chase cam**: the camera sits behind and a little
above your player and smoothly follows you, like the "SA2 Craft" video.
It's made for phones (touch controls), needs **no experimental toggles**, and
was tested on a Minecraft **1.21.0.26 (beta)** server.

## Install on Android

1. Download [`dist/ChaseCam.mcaddon`](dist/ChaseCam.mcaddon).
2. Tap the file and open it with **Minecraft**. It imports two packs:
   *Chase Cam* and *Chase Cam Resources*.
3. Create or edit a world, go to **Behavior Packs**, and activate **Chase Cam**
   (the resource pack is added for you).
4. Play. The chase cam turns on as soon as you join.

## How to use it

When you first join, you get a **Chase Cam Remote** (a little camera item).
Hold it and tap the screen to open the menu (or hold it and crouch):

| Button | What it does |
| --- | --- |
| Turn chase cam OFF / ON | Switch back to the normal camera (handy for building) |
| Camera style | SA2 Chase Cam, Close, Far, Over the Shoulder, Cinematic |
| Fine-tune camera | Sliders for distance, height, look-down angle, side offset, smoothness |
| Speed meter | The `GROUND 21 km/h` readout above the hotbar, like the video |
| Reset to default | Back to the SA2 Chase Cam settings |

Lost the remote? Craft one from **1 stick + 1 glass pane**, or find it in the
creative inventory (Equipment tab). Your settings are saved per player.

With cheats on you can also use commands:
`/scriptevent chasecam:toggle`, `chasecam:on`, `chasecam:off`,
`chasecam:menu`, `chasecam:remote` (gives a remote).

## Good to know

- Like vanilla third person, the camera moves in front of walls instead of
  going through them (you can switch that off in Fine-tune).
- Turn the chase cam off for precise building, since you aim from your
  player's eyes, not from the camera.
- Any behavior pack turns off achievements for that world (that's Minecraft,
  not this add-on).

## Editing it

The packs are plain folders: `ChaseCam_BP` (script + remote item) and
`ChaseCam_RP` (texture + name). The camera logic is in
`ChaseCam_BP/scripts/main.js`. After changing anything, rebuild the file with:

```
python3 build.py
```
