# Bugatti & Sniper — Minecraft Bedrock Add-On (.mcaddon)

Built for **Minecraft Bedrock 1.21+ on Android/iOS** (tested target: the
1.21.0.26 beta shown running on your phone). It contains both packs in one
file — a behaviour pack (RP + BP together, so one tap installs everything):

| Pack | What's in it |
| --- | --- |
| `BugattiSniper_BP` | The car entity, the sniper rifle, the bullet, crafting recipes |
| `BugattiSniper_RP` | Car model, textures, item art, sounds, names |

**Download:** [`dist/BugattiSniper.mcaddon`](dist/BugattiSniper.mcaddon)

---

## Install on your phone

1. Download `dist/BugattiSniper.mcaddon` (tap the file above, then the
   download icon). Save it to **Downloads**.
2. Open your **Files** app → **Downloads** → tap `BugattiSniper.mcaddon`.
3. Choose **Open with Minecraft**. Minecraft launches and shows
   *"Import started"* then *"Successfully imported"*.
4. Go to **Play → your world → Edit (pencil) → Behavior Packs** → activate
   **Bugatti & Sniper BP**. The resource pack is a dependency, so it turns
   itself on. If it asks about *"Activate the resource pack too?"*, say yes.
5. Under **Game Settings**, no experimental toggles are needed.
6. Play.

> If tapping the file does nothing, rename it so it still ends in
> `.mcaddon` (some browsers save it as `.zip` — just rename the extension).

---

## The Bugatti

* **Get it:** Creative inventory → *Spawn Eggs* → **Spawn Bugatti**, or craft
  the egg on a crafting table:

  ```
  [Iron Block] [Iron Block ] [Iron Block]
  [Iron Block] [Diamond Blk] [Iron Block]
  [Gold Block] [Gold Block ] [Gold Block]
  ```

* **Drive it:** tap the car to get in, then steer with the normal movement
  joystick. Jump button works too.
* **Nitro:** while sitting in it, use **coal** or **blaze powder** —
  2.2× speed for 6 seconds.
* Seats **2 players**. Sneak to get out.
* 80 HP, immune to fall/drowning damage, can't be pushed around by mobs.

Top speed is roughly 4× a walking player, which is about as fast as Bedrock
lets a ground entity move without it stuttering through chunks.

## The Sniper

* **Craft it:**

  ```
  [        ] [        ] [Glass Pane]     <- scope
  [Iron Ing] [Iron Ing] [Iron Ingot]     <- barrel + receiver
  [Stick   ] [        ] [          ]     <- stock
  ```

* **Ammo — Sniper Round** (makes 16): iron nugget on top of gunpowder.
* **Fire:** hold to chamber (~0.45 s), release to shoot. It slows your
  movement while aiming, like a real scope.
* **22 damage**, flat trajectory (no bullet drop), explosion particle on
  impact. One shot kills almost anything unarmoured.
* 1500 durability, repairable with iron ingots, enchantable in the bow slot
  (Power, Unbreaking, Infinity…).
* In **Creative** it fires without needing ammo in your inventory.

---

## Rebuilding

Everything generated (textures, the car model, the packed `.mcaddon`) comes
out of one script:

```bash
python3 tools/build.py
```

No dependencies beyond the Python standard library. It regenerates the PNGs
and `bugatti.geo.json`, validates every JSON file in both packs, then zips
`dist/BugattiSniper.mcaddon`.

The car's colours come from a small palette atlas
(`textures/entity/bugatti.png`) — each model face points at a flat colour
region, so recolouring the whole car means editing a few `fill()` calls in
`build.py` rather than repainting a UV map.

## Not affiliated with Bugatti or Mojang

Fan-made add-on, free, not for sale — "Bugatti" here just describes the
supercar shape.
