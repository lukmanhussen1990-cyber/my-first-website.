# --- HAUNTED HOUSE: yard, fence, graveyard, dead trees ---

# Gravel path leading to the front door
fill ~-1 ~0 ~-2 ~1 ~0 ~1 minecraft:gravel

# Dark oak fence around the yard
fill ~-9 ~1 ~-3 ~9 ~1 ~-3 minecraft:dark_oak_fence
fill ~-9 ~1 ~19 ~9 ~1 ~19 minecraft:dark_oak_fence
fill ~-9 ~1 ~-3 ~-9 ~1 ~19 minecraft:dark_oak_fence
fill ~9 ~1 ~-3 ~9 ~1 ~19 minecraft:dark_oak_fence
# Front gate opening
fill ~-1 ~1 ~-3 ~1 ~1 ~-3 minecraft:air

# Jack o'lanterns on the gate posts and corners
setblock ~-2 ~1 ~-3 minecraft:lit_pumpkin
setblock ~2 ~1 ~-3 minecraft:lit_pumpkin
setblock ~-9 ~2 ~-3 minecraft:lit_pumpkin
setblock ~9 ~2 ~-3 minecraft:lit_pumpkin
setblock ~-9 ~2 ~19 minecraft:lit_pumpkin
setblock ~9 ~2 ~19 minecraft:lit_pumpkin

# ---- Graveyard by the front gate ----
setblock ~-8 ~0 ~0 minecraft:soul_sand
setblock ~-6 ~0 ~0 minecraft:soul_sand
setblock ~-4 ~0 ~0 minecraft:soul_sand
setblock ~-8 ~1 ~0 minecraft:cobblestone_wall
setblock ~-6 ~1 ~0 minecraft:cobblestone_wall
setblock ~-4 ~1 ~0 minecraft:cobblestone_wall
setblock ~-8 ~2 ~0 minecraft:mossy_cobblestone
setblock ~-6 ~2 ~0 minecraft:cobblestone
setblock ~-4 ~2 ~0 minecraft:mossy_cobblestone

# ---- Dead trees ----
fill ~-7 ~1 ~14 ~-7 ~5 ~14 minecraft:dark_oak_log
setblock ~-8 ~5 ~14 minecraft:dark_oak_log
setblock ~-6 ~6 ~14 minecraft:dark_oak_log
setblock ~-7 ~6 ~15 minecraft:dark_oak_log
setblock ~-7 ~5 ~13 minecraft:dark_oak_log

fill ~8 ~1 ~8 ~8 ~4 ~8 minecraft:dark_oak_log
setblock ~8 ~5 ~9 minecraft:dark_oak_log
setblock ~8 ~4 ~7 minecraft:dark_oak_log

# ---- Dead bushes scattered around the yard ----
setblock ~-7 ~0 ~-1 minecraft:deadbush
setblock ~7 ~0 ~-1 minecraft:deadbush
setblock ~-8 ~0 ~6 minecraft:deadbush
setblock ~8 ~0 ~12 minecraft:deadbush
setblock ~-3 ~0 ~18 minecraft:deadbush
setblock ~3 ~0 ~18 minecraft:deadbush
