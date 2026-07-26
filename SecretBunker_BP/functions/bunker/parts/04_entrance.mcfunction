# STEP 4 - The secret entrance.
#
# No redstone on purpose. Redstone doors placed by commands are the
# #1 thing that breaks on Bedrock (wrong block rotations), so the
# entrance is a hollow mossy boulder with a hole in the TOP.
# From the ground it just looks like a rock. You only see the hole
# when you climb on top of it.

# Sealed stone casing around the ladder shaft, from just under the
# surface down to the bunker roof. Stops caves/water breaking in.
fill ~-1 ~-12 ~3 ~1 ~3 ~5 stone

# --- The boulder ---
fill ~-2 ~0 ~2 ~2 ~0 ~6 stone
fill ~-2 ~1 ~2 ~2 ~1 ~6 cobblestone
fill ~-2 ~2 ~2 ~2 ~2 ~6 mossy_cobblestone
fill ~-1 ~3 ~3 ~1 ~3 ~5 mossy_cobblestone

# Knock the top corners off so it looks natural, not like a cube
setblock ~-2 ~2 ~2 air
setblock ~2 ~2 ~2 air
setblock ~-2 ~2 ~6 air
setblock ~2 ~2 ~6 air

# Decoy rocks nearby so ONE boulder doesn't stand out
setblock ~-5 ~0 ~3 mossy_cobblestone
setblock ~-6 ~0 ~5 cobblestone
setblock ~-4 ~0 ~8 mossy_cobblestone
setblock ~5 ~0 ~2 cobblestone
setblock ~6 ~0 ~6 mossy_cobblestone
setblock ~4 ~0 ~9 cobblestone
setblock ~-7 ~0 ~9 mossy_cobblestone

# --- Punch the shaft and drop the ladder in ---
fill ~0 ~-19 ~4 ~0 ~3 ~4 air
fill ~0 ~-19 ~4 ~0 ~3 ~4 ladder ["facing_direction"=3]
