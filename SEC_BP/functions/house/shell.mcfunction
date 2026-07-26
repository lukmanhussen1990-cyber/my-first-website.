# House walls, windows and front door. Called by house/build.

# House wall and ceiling inside the compound.
fill ~-7 ~ ~-7 ~7 ~4 ~-7 sec:reinforced_wall
fill ~-7 ~ ~7 ~7 ~4 ~7 sec:reinforced_wall
fill ~-7 ~ ~-6 ~-7 ~4 ~6 sec:reinforced_wall
fill ~7 ~ ~-6 ~7 ~4 ~6 sec:reinforced_wall
fill ~-7 ~5 ~-7 ~7 ~5 ~7 sec:reinforced_wall

# Blast glass windows - 900 explosion resistance, same as the walls.
fill ~-5 ~2 ~-7 ~-3 ~3 ~-7 sec:blast_glass
fill ~-5 ~2 ~7 ~-3 ~3 ~7 sec:blast_glass
fill ~-7 ~2 ~-5 ~-7 ~3 ~-3 sec:blast_glass
fill ~7 ~2 ~-5 ~7 ~3 ~-3 sec:blast_glass
fill ~3 ~2 ~-7 ~5 ~3 ~-7 sec:blast_glass
fill ~3 ~2 ~7 ~5 ~3 ~7 sec:blast_glass
fill ~-7 ~2 ~3 ~-7 ~3 ~5 sec:blast_glass
fill ~7 ~2 ~3 ~7 ~3 ~5 sec:blast_glass

# Front door, in line with the gate.
fill ~-1 ~ ~7 ~ ~1 ~7 air
setblock ~-1 ~ ~7 minecraft:iron_door ["direction":1,"door_hinge_bit":false,"open_bit":false,"upper_block_bit":false]
setblock ~-1 ~1 ~7 minecraft:iron_door ["direction":1,"door_hinge_bit":false,"open_bit":false,"upper_block_bit":true]
setblock ~ ~ ~7 minecraft:iron_door ["direction":1,"door_hinge_bit":true,"open_bit":false,"upper_block_bit":false]
setblock ~ ~1 ~7 minecraft:iron_door ["direction":1,"door_hinge_bit":true,"open_bit":false,"upper_block_bit":true]
setblock ~ ~ ~6 minecraft:lever ["lever_direction":"up_north_south","open_bit":false]
setblock ~-1 ~ ~8 minecraft:lever ["lever_direction":"up_north_south","open_bit":false]
