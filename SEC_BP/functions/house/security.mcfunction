# Arrow traps and the entry alarm. Called by house/build.

# Arrow traps: dispenser in the floor facing up, pressure plate on top.
# Deliberately off the entrance path so you do not shoot yourself.
setblock ~9 ~-1 ~9 minecraft:dispenser ["facing_direction":1]
setblock ~9 ~ ~9 minecraft:heavy_weighted_pressure_plate
setblock ~-9 ~-1 ~9 minecraft:dispenser ["facing_direction":1]
setblock ~-9 ~ ~9 minecraft:heavy_weighted_pressure_plate
setblock ~9 ~-1 ~-9 minecraft:dispenser ["facing_direction":1]
setblock ~9 ~ ~-9 minecraft:heavy_weighted_pressure_plate
setblock ~-9 ~-1 ~-9 minecraft:dispenser ["facing_direction":1]
setblock ~-9 ~ ~-9 minecraft:heavy_weighted_pressure_plate
setblock ~9 ~-1 ~ minecraft:dispenser ["facing_direction":1]
setblock ~9 ~ ~ minecraft:heavy_weighted_pressure_plate
setblock ~-9 ~-1 ~ minecraft:dispenser ["facing_direction":1]
setblock ~-9 ~ ~ minecraft:heavy_weighted_pressure_plate
setblock ~ ~-1 ~-9 minecraft:dispenser ["facing_direction":1]
setblock ~ ~ ~-9 minecraft:heavy_weighted_pressure_plate
setblock ~4 ~-1 ~9 minecraft:dispenser ["facing_direction":1]
setblock ~4 ~ ~9 minecraft:heavy_weighted_pressure_plate
setblock ~-4 ~-1 ~9 minecraft:dispenser ["facing_direction":1]
setblock ~-4 ~ ~9 minecraft:heavy_weighted_pressure_plate

# Entry alarm: plates just inside the gate power the lamps and note
# blocks buried beside them, so anything coming through is loud and lit.
setblock ~-1 ~ ~10 minecraft:heavy_weighted_pressure_plate
setblock ~-1 ~-1 ~11 minecraft:noteblock
setblock ~ ~ ~10 minecraft:heavy_weighted_pressure_plate
setblock ~ ~-1 ~11 minecraft:noteblock
setblock ~-2 ~-1 ~10 minecraft:redstone_lamp
setblock ~1 ~-1 ~10 minecraft:redstone_lamp
