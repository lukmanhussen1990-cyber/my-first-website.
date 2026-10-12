# Giant Spider Hunter — Minecraft Bedrock add-on

A small spider watches you from the trees. Once its eyes are on you, it grows into a giant whose
body rises far above the forest canopy and whose legs span several trees — and it hunts you.

* Built for **Minecraft Bedrock Beta 1.21.0.26** (tested on the matching 1.21.0.26 dedicated server).
* Entity id: `horror:giant_spider` · display name **Giant Spider Hunter**.
* **No experiment toggles are required.** The script uses the stable `@minecraft/server` **1.10.0**.

## Install on Android

1. Download **`GiantSpiderHunter.mcaddon`** to your phone.
2. Open it from the Files app (or your browser's downloads) and choose **Minecraft** — the game
   imports both packs ("Giant Spider Hunter (Behavior)" and "Giant Spider Hunter (Resources)").
   If tapping does nothing: rename it to `.zip` is **not** needed — instead use *Share → Minecraft*.
3. Create a new world (or edit an existing one):
   * **Behavior Packs → Available → Giant Spider Hunter (Behavior) → Activate.** The resource pack is
     activated automatically because the packs depend on each other (check *Resource Packs* to be sure).
   * Experiments: **leave everything off** — none are needed.
   * Difficulty: Easy, Normal or Hard (Peaceful disables the hunter).
4. Play in **Survival** or **Adventure**. Creative and Spectator players are ignored.

## What happens (automatic — no summoning needed)

* After you have spent **60–120 seconds in the Overworld**, the first encounter starts by itself:
  a small spider appears **32–48 blocks away** on solid ground, preferring forests (any safe land is
  used if no forest is near). Only **one** automatically managed hunter exists at a time.
* **Stalking:** the small spider watches you, turns to face you and quietly relocates behind trees
  when you are not looking.
* **It notices you** when you **look at it** (clear line of sight), **walk close** (≈10 blocks),
  **hit it**, or after it has stalked you for **90 s**.
* **Growing → hunting:** it roars, the ground shakes and it grows into the giant (≈4 s, invulnerable),
  then chases you fast through forests and over hills. Its legs strike you when you are genuinely
  within reach of its body and legs — also while flying with an Elytra past it — but never from far
  away just because you are its target.
* **Escape:** get far away (64+ blocks for 3 s) or break contact for 15 s. It loses interest, shrinks
  back and wanders off; later it may stalk you again or disappear. A new encounter comes after a
  cooldown of 5–8 minutes.
* **Death:** if you manage to kill it, it curls up and collapses, dropping string, spider eyes and XP.
* Dying gives you a respawn grace period; leaving the world, reloading or travelling far away never
  creates duplicate hunters.

## Spawn egg and commands (optional, for testing)

* Creative inventory → spawn eggs → **Giant Spider Hunter**.
* `/summon horror:giant_spider` — small stalker.
* `/summon horror:giant_spider ~ ~ ~ 0 0 horror:spawn_giant` — a giant that hunts at once
  (in 1.21.0.26 the spawn event must come after the two rotation numbers).
* Settings (cheats on): `/scriptevent gsh:status`, `/scriptevent gsh:spawn` (encounter now),
  `/scriptevent gsh:reset`, `/scriptevent gsh:config <key> <value>`, `/scriptevent gsh:challenge on|off`,
  `/scriptevent gsh:debug on|off`, `/scriptevent gsh:grow` (nearest spider sees you).

## Challenge mode (off by default)

`/scriptevent gsh:challenge on` gives every survival player an Elytra and fireworks once, three lives
(then spectator), and the rule that flight equipment only works while the spider is chasing you.

## Configuration

All tunables live in `packs/GiantSpiderHunter_BP/scripts/config.js` and can be changed in game with
`/scriptevent gsh:config <key> <value>` (saved in the world): sizes (`smallScale`, `giantScale`),
`growTime`/`growthDurationSeconds`, `health`, `strikeDamage`, `biteDamage`, damage per difficulty,
`chaseSpeedMultiplier`, detection ranges (`lookRange`, `approachRange`, `idleRange`), stalking timeout,
escape rules (`escapeDistance`, `breakContactSeconds`, `maxChaseSeconds`, `relentless`), spawn timing
and distances, cooldowns and challenge mode. See `docs/` for the full design.
