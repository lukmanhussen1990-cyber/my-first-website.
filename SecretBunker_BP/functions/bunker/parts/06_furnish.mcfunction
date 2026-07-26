# STEP 6 - Furniture. All plain setblock/fill, no entities,
# so nothing here can fail to spawn or despawn later.

# ---------- LANDING / AIRLOCK ----------
setblock ~-3 ~-19 ~5 furnace
setblock ~-2 ~-19 ~5 crafting_table
setblock ~2 ~-19 ~5 chest
setblock ~3 ~-19 ~5 chest
setblock ~3 ~-19 ~8 barrel
setblock ~-3 ~-19 ~8 barrel

# ---------- MAIN HALL: the "reactor" centrepiece ----------
fill ~-1 ~-20 ~16 ~1 ~-20 ~18 iron_block
setblock ~0 ~-19 ~17 sea_lantern
fill ~-1 ~-19 ~16 ~1 ~-19 ~18 iron_bars replace air
fill ~-1 ~-18 ~16 ~1 ~-18 ~18 iron_bars replace air

# ---------- WORKSHOP / ARMOURY (x 8..13, z 12..16) ----------
setblock ~9 ~-19 ~12 anvil
setblock ~10 ~-19 ~12 grindstone
setblock ~11 ~-19 ~12 smithing_table
setblock ~12 ~-19 ~12 cartography_table
fill ~13 ~-19 ~12 ~13 ~-19 ~13 furnace
setblock ~13 ~-19 ~14 blast_furnace
setblock ~13 ~-19 ~15 smoker
fill ~9 ~-19 ~16 ~12 ~-19 ~16 chest
fill ~9 ~-18 ~16 ~12 ~-18 ~16 iron_bars

# ---------- LIVING QUARTERS (x -13..-8, z 18..23) ----------
fill ~-13 ~-19 ~18 ~-13 ~-17 ~23 bookshelf
setblock ~-12 ~-19 ~19 enchanting_table
setblock ~-9 ~-19 ~19 brewing_stand
setblock ~-9 ~-19 ~22 cauldron
setblock ~-12 ~-19 ~22 jukebox
setblock ~-8 ~-19 ~18 crafting_table
setblock ~-8 ~-19 ~23 chest
setblock ~-10 ~-19 ~19 chest

# ---------- COMMAND ROOM (x 8..13, z 18..23) ----------
fill ~9 ~-19 ~19 ~12 ~-19 ~19 iron_block
fill ~9 ~-18 ~19 ~12 ~-18 ~19 redstone_lamp
setblock ~13 ~-19 ~20 lectern
setblock ~13 ~-19 ~21 cartography_table
fill ~8 ~-19 ~23 ~12 ~-19 ~23 chest
setblock ~8 ~-19 ~18 barrel
