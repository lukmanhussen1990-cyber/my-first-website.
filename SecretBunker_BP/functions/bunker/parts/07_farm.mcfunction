# STEP 7 - Underground farm (x -13..-8, z 12..16).
# Sea lanterns overhead give light level 15, so wheat grows down here
# exactly like it does on the surface.

# Whole floor to farmland, then a walkway back down the east edge
fill ~-13 ~-20 ~12 ~-8 ~-20 ~16 farmland
fill ~-8 ~-20 ~12 ~-8 ~-20 ~16 polished_deepslate

# Irrigation trench (x -11). Everything is within 2 blocks of water,
# so the whole field stays hydrated.
fill ~-11 ~-20 ~13 ~-11 ~-20 ~15 water

# Fully grown wheat both sides of the trench
fill ~-13 ~-19 ~12 ~-12 ~-19 ~16 wheat ["growth"=7]
fill ~-10 ~-19 ~12 ~-9 ~-19 ~16 wheat ["growth"=7]

# Storage / composting on the walkway
setblock ~-8 ~-19 ~12 composter
setblock ~-8 ~-19 ~13 barrel
fill ~-8 ~-19 ~15 ~-8 ~-19 ~16 hay_block
