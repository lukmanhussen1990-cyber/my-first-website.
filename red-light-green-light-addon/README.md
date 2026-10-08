# Red Light, Green Light (Squid Game) — Minecraft Bedrock add-on

A minigame add-on for **Minecraft Bedrock 1.21.0** and newer (including Android beta 1.21.0.26).
It uses only the **stable** Script API (`@minecraft/server` 1.10.0) and no commands, so it works in
survival without cheats.

## Folder structure

```
red-light-green-light-addon/
├── RedLightGreenLight.mcaddon      <- ready to import (just tap it on your phone)
└── RedLightGreenLight_BP/          <- the behavior pack (what is inside the .mcaddon)
    ├── manifest.json
    ├── pack_icon.png               (optional, just the picture in the pack list)
    ├── items/
    │   └── game_whistle.json
    └── scripts/
        └── main.js                 <- all game logic, settings at the top
```

No resource pack is needed. The whistle uses the vanilla **goat horn** icon (version 1.21.0.26 has
no "bell" item icon, so a bell would show as a missing texture).

## How the game works

- Every player gets the **Red Light Green Light Whistle** when they spawn (only if they don't have one).
  It stays with you when you die, so it can never drop and turn into a second whistle.
- Use the whistle (tap, or right-click on PC) to **start**. Players within 30 blocks of the start
  join and are lined up at the start, looking at the doll.
- The player who started the game uses the whistle again to **stop** it. (If that player left the
  world, anyone can stop it.) Other players get a message instead, so only one game runs at a time.
- **GREEN LIGHT** (4–8 s): the doll looks away. Move!
- **RED LIGHT** (2–5 s): the doll turns to you. After 0.75 s to react, anyone who moves 0.1 blocks
  or more is out: they are sent to the "out" spot and see `You moved! You are out.`
- The first player to reach the finish area wins (announced in chat). When someone wins or everyone
  is out, the doll is removed and everyone is sent back to the start, ready for the next round.

## Settings

Open `RedLightGreenLight_BP/scripts/main.js`. Everything you can change is in `CONFIG` at the top:
start position, doll position, finish area corners, out position, light times, reaction time,
move tolerance and whether the whistle is given on every spawn.

The default positions fit a **Flat** world (the ground is at y = -61, so you stand at y = -60):

| What | Default |
|---|---|
| Start | 0, -60, 0 |
| Doll | 0, -60, 50 |
| Finish area | from -15, -61, 44 to 15, -55, 48 |
| Out spot | -25, -60, 0 |

For your own playground, turn on **Show Coordinates** in the world settings, stand on each spot and
write down the numbers.

## Install on your Android phone

### Option A: use the ready-made file

1. Download `RedLightGreenLight.mcaddon` to your phone.
2. Open your **Files** app → **Downloads** → tap `RedLightGreenLight.mcaddon` → choose **Minecraft**.
3. Minecraft opens and shows "Import started…" and then "Successfully imported".

If the browser saved it as `.zip`, rename it back to `.mcaddon` first. If tapping it does not offer
Minecraft, open it with a file manager such as ZArchiver and pick "Open with" → Minecraft.

### Option B: make the .mcaddon yourself

1. Install **ZArchiver** (free on Google Play) and a text editor such as **Acode** or **QuickEdit**.
2. Make the folders and files exactly as in the folder structure above and paste in the code.
   Names must match exactly (for example `main.js`, not `main.js.txt`).
3. In ZArchiver, long-press the **RedLightGreenLight_BP** folder → **Compress** → format **zip** →
   name it `RedLightGreenLight` → OK.
4. Long-press `RedLightGreenLight.zip` → **Rename** → `RedLightGreenLight.mcaddon`.
5. Tap the `.mcaddon` file and open it with Minecraft (see Option A).

Zip the **folder**, not just the files inside it, so the zip contains
`RedLightGreenLight_BP/manifest.json`.

## Set up a world

1. **Play** → **Create New** → **Create New World**.
2. Set **World Type** to **Flat** (to use the default positions) and turn on **Show Coordinates**.
3. **Beta APIs (optional):** this add-on uses only stable APIs, so you do **not** need it.
   If you still want it: find **Experiments** (scroll down; on some screens it's under
   General or Advanced) and turn on **Beta APIs**. You can't turn experiments off later for that world.
4. Open **Behavior Packs** → **Available** → tap **Red Light, Green Light** → **Activate**.
   (Minecraft may say achievements are turned off; that happens with every add-on.)
5. Tap **Create**.

For an existing world: tap the **pencil (edit)** icon next to it → **Behavior Packs** → Activate.

## Test it

1. When the world loads, look in your inventory: the shiny goat horn named
   **Red Light Green Light Whistle** should be there.
2. Walk to x = 0, z = 0 (use the coordinates on screen).
3. Use the whistle. You get lined up at the start and a doll with a pumpkin head appears 50 blocks away.
4. Play! Move on GREEN, freeze on RED, and run into the finish area in front of the doll.

### Checklist

- [ ] **Spawn item:** you have exactly 1 whistle after joining. Die and respawn: still 1.
      Put it in a chest, leave the world and join again: you get 1 new whistle.
- [ ] **Start:** using the whistle near the start begins the game, the doll appears and
      you're lined up at the start. A player farther than 30 blocks away does not join.
- [ ] **Green light:** green "GREEN LIGHT" title + sound, the doll's back is to you, moving is fine.
      It lasts 4–8 seconds.
- [ ] **Red light:** red "RED LIGHT" title + bell sound, the doll's pumpkin face turns to you.
      Standing still (or just turning your camera) is fine. It lasts 2–5 seconds.
- [ ] **Out:** walk during red light (after the first moment) → you are sent to the out spot and
      chat says `You moved! You are out.`
- [ ] **Finish:** reach the finish area on green → chat announces you as the winner.
- [ ] **Reset:** after a win, after everyone is out, or after you stop the game with the whistle,
      the doll disappears, everyone is back at the start, and the whistle starts a new game.

## Tips and troubleshooting

- **During a game, switch to another hotbar slot.** If you are holding the whistle, a quick tap on
  the screen uses it and stops your game.
- **"Nobody is within 30 blocks of the start"**: walk closer to `startPos`, or change it in `main.js`.
- **"Could not place the doll"**: the doll spot is too far away to be loaded. Move `dollPos` closer
  to the start (within about 60 blocks).
- **Nothing happens at all**: check the pack is active in the world's Behavior Packs. To see script
  errors, go to **Settings** → **Creator** → turn on **Content Log GUI**.
- **Changed `main.js` but the game didn't change?** Raise the three `version` numbers in
  `manifest.json` (for example to `[1, 0, 1]`), zip again and import again. Or delete the old pack
  first in **Settings** → **Storage**.
