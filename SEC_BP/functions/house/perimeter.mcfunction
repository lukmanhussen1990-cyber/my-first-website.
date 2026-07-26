# Outer wall, roof and gate. Called by house/build.

# Double-thickness outer wall, 8 blocks tall.
fill ~-12 ~ ~-12 ~12 ~7 ~-11 sec:reinforced_wall
fill ~-12 ~ ~11 ~12 ~7 ~12 sec:reinforced_wall
fill ~-12 ~ ~-10 ~-11 ~7 ~10 sec:reinforced_wall
fill ~11 ~ ~-10 ~12 ~7 ~10 sec:reinforced_wall

# Overhang at the top so spiders cannot climb over the outside face.
fill ~-13 ~7 ~-13 ~13 ~7 ~-13 sec:reinforced_wall
fill ~-13 ~7 ~13 ~13 ~7 ~13 sec:reinforced_wall
fill ~-13 ~7 ~-12 ~-13 ~7 ~12 sec:reinforced_wall
fill ~13 ~7 ~-12 ~13 ~7 ~12 sec:reinforced_wall

# Roof over the whole compound - nothing drops or flies in.
fill ~-12 ~8 ~-12 ~12 ~8 ~12 sec:reinforced_wall
# Bar parapet so the roof is safe to stand on.
fill ~-12 ~9 ~-12 ~12 ~9 ~-12 minecraft:iron_bars
fill ~-12 ~9 ~12 ~12 ~9 ~12 minecraft:iron_bars
fill ~-12 ~9 ~-11 ~-12 ~9 ~11 minecraft:iron_bars
fill ~12 ~9 ~-11 ~12 ~9 ~11 minecraft:iron_bars

# Gate: 2-wide opening through both wall layers, double iron door.
fill ~-1 ~ ~11 ~ ~1 ~12 air
setblock ~-1 ~ ~12 minecraft:iron_door ["direction":1,"door_hinge_bit":false,"open_bit":false,"upper_block_bit":false]
setblock ~-1 ~1 ~12 minecraft:iron_door ["direction":1,"door_hinge_bit":false,"open_bit":false,"upper_block_bit":true]
setblock ~ ~ ~12 minecraft:iron_door ["direction":1,"door_hinge_bit":true,"open_bit":false,"upper_block_bit":false]
setblock ~ ~1 ~12 minecraft:iron_door ["direction":1,"door_hinge_bit":true,"open_bit":false,"upper_block_bit":true]
# Levers - iron doors only move on redstone.
setblock ~ ~ ~11 minecraft:lever ["lever_direction":"up_north_south","open_bit":false]
setblock ~-1 ~ ~13 minecraft:lever ["lever_direction":"up_north_south","open_bit":false]
