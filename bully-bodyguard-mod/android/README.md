# Rockstar Bodyguard Mod: Android (Bully: Anniversary Edition)

No mod loader needed. The mod replaces the game's `STimeCycle` script,
which runs every time the world loads.

## What it does
- 3 bodyguards (Russell, Johnny, Ted) are hired automatically once you're in the world.
- They follow Jimmy and attack anyone who hits him.
- They're invincible. If one dies or gets unloaded, a replacement spawns after 5 s.
- If a bodyguard falls behind (40 m or more), they teleport back to you.

## Controls (no keyboard, so they use lock-on)
| Do this | Result |
|---|---|
| Lock on to someone and **hold it for 2 seconds** | All bodyguards attack them |
| Lock on to **one of your own bodyguards** for 3 seconds | All bodyguards are dismissed (they come back the next time the world loads) |

## Files
| File | Use |
|---|---|
| `compiled/A_standard/STimeCycle.lur` | **Try this first** (the standard Bully script format) |
| `compiled/B_64bit/STimeCycle.lur` | Try this if A doesn't work (for 64-bit builds of the game) |
| `STimeCycle.lua` | Source code. Edit `BG_CONFIG` at the top to change guards, weapon and so on |
| `tools/` | The compiler used to build the `.lur` files |

## Install steps

### 1. Get the tools (free, on the Play Store)
- **ZArchiver** or **MT Manager** (file managers that can open `Android/data` and `Android/obb`)
- **Shizuku**, only if you're on Android 11 or newer and your file manager can't open `Android/data`
- An **IMG editor** app that can open GTA/Bully `.img` archives (search the Play Store for "IMG Tool")

### 2. Find the game's `Scripts.img`
Look in these places:
- `Android/data/com.rockstargames.bully/files/`
- `Android/obb/com.rockstargames.bully/`. The `.obb` file is an archive; open it with ZArchiver or MT Manager and look for `Scripts/Scripts.img`

### 3. BACK UP `Scripts.img`
Copy it to a safe place, such as `Download/Scripts_BACKUP.img`. If anything goes wrong,
put this copy back and the game will be normal again.

### 4. Replace `STimeCycle.lur`
1. Open `Scripts.img` in the IMG editor.
2. Find `STimeCycle.lur`.
3. Replace or import it with `compiled/A_standard/STimeCycle.lur` from this mod.
4. Save or rebuild the archive.
5. If the game loaded `Scripts.img` from inside the `.obb`, put the edited file back into the `.obb`
   **without compression** ("store" mode).

### 5. Test
Start the game and load a save. About 2 seconds after the world appears you should see
*"Bodyguards hired: 3"* and three guards next to Jimmy.

### If it doesn't work
| What happens | What to do |
|---|---|
| No guards, no message, but the game runs | Try `compiled/B_64bit/STimeCycle.lur` instead |
| Game crashes on load | Restore your backup `Scripts.img`, then try B |
| Guards appear but something's off | Tell me what you see and I'll adjust the script |

## Editing the mod
Change `BG_CONFIG` at the top of `STimeCycle.lua`
(`MAX_GUARDS`, `MODELS`, `WEAPON`, `INVINCIBLE`, ...). The file then has to be
recompiled into `.lur`, so ask me or use the tools in `tools/` on a PC.

## Heads-up
- This hasn't been tested on a real phone. The script logic was tested with a
  Lua 5.0 interpreter using stand-in game functions.
- The class/curfew/bell functions at the bottom of the file are a reconstruction of the
  game's original `STimeCycle`. If class attendance or curfew acts strangely,
  restore your backup and tell me.
- iPhone isn't supported, because game files can't be replaced without a jailbreak.
