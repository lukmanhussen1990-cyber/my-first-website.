# STEP 9 - Escape tunnel.
# Runs east out of the command room for 16 blocks, then climbs a
# ladder shaft up into a second decoy boulder on the surface, ~30
# blocks away from the main entrance.

# Tunnel shell (sealed, same trick as the main build)
fill ~14 ~-21 ~19 ~32 ~-13 ~21 deepslate_bricks

# Blast-door frame where it leaves the command room
fill ~14 ~-19 ~19 ~14 ~-16 ~21 iron_block replace deepslate_bricks

# Sealed casing for the exit shaft, ground level down to the tunnel
fill ~29 ~-12 ~19 ~31 ~3 ~21 stone

# --- Exit boulder ---
fill ~28 ~0 ~18 ~32 ~0 ~22 stone
fill ~28 ~1 ~18 ~32 ~1 ~22 cobblestone
fill ~28 ~2 ~18 ~32 ~2 ~22 mossy_cobblestone
fill ~29 ~3 ~19 ~31 ~3 ~21 mossy_cobblestone
setblock ~28 ~2 ~18 air
setblock ~32 ~2 ~18 air
setblock ~28 ~2 ~22 air
setblock ~32 ~2 ~22 air

# --- Carve the tunnel, then the shaft, then ladder the shaft ---
fill ~14 ~-19 ~20 ~29 ~-17 ~20 air
fill ~30 ~-19 ~20 ~30 ~3 ~20 air
fill ~30 ~-19 ~20 ~30 ~3 ~20 ladder ["facing_direction"=3]

# Tunnel lights
setblock ~17 ~-16 ~20 sea_lantern
setblock ~21 ~-16 ~20 sea_lantern
setblock ~25 ~-16 ~20 sea_lantern
setblock ~28 ~-16 ~20 sea_lantern
