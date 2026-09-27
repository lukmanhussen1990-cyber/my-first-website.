# Rockstar Bodyguard Mod: Bully: Scholarship Edition (PC)

Hire up to 3 bodyguards who follow Jimmy around, jump in when someone hits him,
and attack whoever you point them at.

## Requirements
- Bully: Scholarship Edition (PC)
- [Derpy's Script Loader (DSL)](https://www.bully-board.com/) installed in your game folder

## Install
Copy the `_derpy_script_loader` folder from this directory into your Bully install
folder (the one with `Bully.exe`), and merge it with the folder that's already there:

```
Bully Scholarship Edition/
└── _derpy_script_loader/
    └── scripts/
        └── RockstarBodyguard/
            └── main.lua
```

Start the game. Once you're in the world, you'll see *"Rockstar Bodyguard Mod loaded"*.

## Controls
| Key | Action |
|-----|--------|
| F5  | Hire a bodyguard (max 3) |
| F6  | Dismiss all bodyguards |
| F7  | Send bodyguards after the person you're locked on to |
| F8  | Turn invincible bodyguards on or off |

## Features
- Bodyguards are recruited as allies, so they follow you and fight with you.
- They attack anyone who hits Jimmy, on their own.
- They are invincible (can be turned off).
- If a guard dies or gets unloaded (for example, when you enter a building), a replacement spawns after 5 s.
- If a guard falls more than 40 m behind, they teleport back to you.

## Configuration
Edit the `CONFIG` table at the top of `main.lua`:
- `MODELS`: the ped model IDs used for guards (defaults are the clique leaders: Russell, Johnny, Ted and Derby).
- `WEAPON` / `WEAPON_AMMO`: the weapon each guard carries (`nil` means fists only).
- `MAX_GUARDS`, `INVINCIBLE`, `AUTO_RESPAWN`, `RESPAWN_DELAY`, `LEASH_DIST`
- `KEY_*`: rebind the controls.

## Notes
- Every game call is wrapped in `pcall`, so a native function that's missing or
  different in your DSL version won't crash the script.
- Model and weapon IDs can differ between builds. If a guard doesn't appear,
  try another model ID.
