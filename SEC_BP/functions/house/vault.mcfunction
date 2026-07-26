# Safe room inside the house. Called by house/build.

# Vault in the north-west corner: 3600 explosion resistance walls.
fill ~-2 ~ ~-6 ~-2 ~4 ~-2 sec:vault_wall
fill ~-6 ~ ~-2 ~-3 ~4 ~-2 sec:vault_wall

# Vault door.
fill ~-4 ~ ~-2 ~-4 ~1 ~-2 air
setblock ~-4 ~ ~-2 minecraft:iron_door ["direction":1,"door_hinge_bit":false,"open_bit":false,"upper_block_bit":false]
setblock ~-4 ~1 ~-2 minecraft:iron_door ["direction":1,"door_hinge_bit":false,"open_bit":false,"upper_block_bit":true]
setblock ~-4 ~ ~-1 minecraft:lever ["lever_direction":"up_north_south","open_bit":false]
setblock ~-4 ~ ~-3 minecraft:lever ["lever_direction":"up_north_south","open_bit":false]

# Storage. Chests come empty.
setblock ~-6 ~ ~-6 minecraft:chest
setblock ~-6 ~ ~-5 minecraft:chest
setblock ~-6 ~ ~-4 minecraft:chest
setblock ~-6 ~ ~-3 minecraft:chest
setblock ~-5 ~ ~-6 minecraft:chest
setblock ~-4 ~ ~-6 minecraft:chest
setblock ~-3 ~ ~-6 minecraft:chest
