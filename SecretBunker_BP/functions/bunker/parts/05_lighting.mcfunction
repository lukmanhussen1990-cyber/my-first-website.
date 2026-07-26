# STEP 5 - Lighting.
# Sea lanterns set INTO the ceiling. Fully lit = no mobs spawn
# anywhere inside the bunker, and it costs zero frames on mobile
# (no particles, no redstone ticking).

# Landing
fill ~-2 ~-14 ~6 ~2 ~-14 ~6 sea_lantern

# Corridor (only 3 high, so the light sits at Y -16)
setblock ~0 ~-16 ~10 sea_lantern
setblock ~0 ~-16 ~11 sea_lantern

# Main hall
fill ~-4 ~-14 ~14 ~4 ~-14 ~14 sea_lantern
fill ~-4 ~-14 ~18 ~4 ~-14 ~18 sea_lantern
fill ~-4 ~-14 ~21 ~4 ~-14 ~21 sea_lantern

# Farm room
fill ~-12 ~-14 ~13 ~-9 ~-14 ~13 sea_lantern
fill ~-12 ~-14 ~16 ~-9 ~-14 ~16 sea_lantern

# Workshop
fill ~9 ~-14 ~13 ~12 ~-14 ~13 sea_lantern
fill ~9 ~-14 ~16 ~12 ~-14 ~16 sea_lantern

# Living quarters
fill ~-12 ~-14 ~19 ~-9 ~-14 ~19 sea_lantern
fill ~-12 ~-14 ~22 ~-9 ~-14 ~22 sea_lantern

# Command room
fill ~9 ~-14 ~19 ~12 ~-14 ~19 sea_lantern
fill ~9 ~-14 ~22 ~12 ~-14 ~22 sea_lantern
