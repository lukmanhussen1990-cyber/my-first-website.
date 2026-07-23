# --- HAUNTED HOUSE: shell (foundation, walls, floors, roof) ---
# Built relative to the player. Footprint x[-6..6] z[2..16], floor at y0.

# Clear the build volume so nothing is in the way
fill ~-9 ~0 ~-3 ~9 ~18 ~19 minecraft:air

# Foundation pad
fill ~-8 ~-1 ~0 ~8 ~-1 ~18 minecraft:cobblestone

# Ground floor
fill ~-6 ~0 ~2 ~6 ~0 ~16 minecraft:dark_oak_planks

# ---- Story 1 walls (y1..y4) ----
fill ~-6 ~1 ~2 ~6 ~4 ~2 minecraft:dark_oak_planks
fill ~-6 ~1 ~16 ~6 ~4 ~16 minecraft:dark_oak_planks
fill ~-6 ~1 ~2 ~-6 ~4 ~16 minecraft:dark_oak_planks
fill ~6 ~1 ~2 ~6 ~4 ~16 minecraft:dark_oak_planks

# Mossy cobblestone base course (y1)
fill ~-6 ~1 ~2 ~6 ~1 ~2 minecraft:mossy_cobblestone
fill ~-6 ~1 ~16 ~6 ~1 ~16 minecraft:mossy_cobblestone
fill ~-6 ~1 ~2 ~-6 ~1 ~16 minecraft:mossy_cobblestone
fill ~6 ~1 ~2 ~6 ~1 ~16 minecraft:mossy_cobblestone

# Second floor / ceiling of story 1 (y5)
fill ~-6 ~5 ~2 ~6 ~5 ~16 minecraft:dark_oak_planks

# ---- Story 2 walls (y6..y9) ----
fill ~-6 ~6 ~2 ~6 ~9 ~2 minecraft:dark_oak_planks
fill ~-6 ~6 ~16 ~6 ~9 ~16 minecraft:dark_oak_planks
fill ~-6 ~6 ~2 ~-6 ~9 ~16 minecraft:dark_oak_planks
fill ~6 ~6 ~2 ~6 ~9 ~16 minecraft:dark_oak_planks

# Attic floor / ceiling of story 2 (y10)
fill ~-6 ~10 ~2 ~6 ~10 ~16 minecraft:dark_oak_planks

# ---- Gable roof (ridge runs north-south along z) ----
fill ~-7 ~10 ~1 ~7 ~10 ~17 minecraft:dark_oak_planks
fill ~-6 ~11 ~2 ~6 ~11 ~16 minecraft:dark_oak_planks
fill ~-5 ~12 ~2 ~5 ~12 ~16 minecraft:dark_oak_planks
fill ~-4 ~13 ~2 ~4 ~13 ~16 minecraft:dark_oak_planks
fill ~-3 ~14 ~2 ~3 ~14 ~16 minecraft:dark_oak_planks
fill ~-2 ~15 ~2 ~2 ~15 ~16 minecraft:dark_oak_planks
fill ~-1 ~16 ~2 ~1 ~16 ~16 minecraft:dark_oak_planks
fill ~0 ~17 ~2 ~0 ~17 ~16 minecraft:dark_oak_planks

# Chimney poking through the roof
fill ~0 ~10 ~15 ~0 ~13 ~15 minecraft:cobblestone
setblock ~0 ~14 ~15 minecraft:campfire

# Hole in second floor for stair access (near back-right corner)
fill ~3 ~5 ~13 ~4 ~5 ~14 minecraft:air
