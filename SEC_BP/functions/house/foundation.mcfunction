# Platform, floor and lava moat. Called by house/build.

# Solid slab so nothing can tunnel or spawn underneath.
fill ~-16 ~-3 ~-16 ~16 ~-2 ~16 sec:reinforced_wall
# Walking surface.
fill ~-16 ~-1 ~-16 ~16 ~-1 ~16 sec:security_floor

# Lava moat: a one-deep trench so nothing wanders in from open ground.
fill ~-14 ~-1 ~-14 ~14 ~-1 ~-14 air
fill ~-14 ~-1 ~14 ~14 ~-1 ~14 air
fill ~-14 ~-1 ~-13 ~-14 ~-1 ~13 air
fill ~14 ~-1 ~-13 ~14 ~-1 ~13 air
fill ~-14 ~-2 ~-14 ~14 ~-2 ~-14 minecraft:lava
fill ~-14 ~-2 ~14 ~14 ~-2 ~14 minecraft:lava
fill ~-14 ~-2 ~-13 ~-14 ~-2 ~13 minecraft:lava
fill ~14 ~-2 ~-13 ~14 ~-2 ~13 minecraft:lava
# Causeway over the moat, lined up with the gate.
fill ~-1 ~-1 ~14 ~1 ~-1 ~14 sec:security_floor
