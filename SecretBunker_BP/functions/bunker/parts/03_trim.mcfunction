# STEP 3 - Trim & detailing.
# "replace deepslate_bricks" means only the solid walls change,
# the air in the rooms is left alone.

# Floor slab
fill ~-14 ~-20 ~3 ~14 ~-20 ~28 polished_deepslate

# Ceiling
fill ~-14 ~-14 ~3 ~14 ~-14 ~28 deepslate_tiles replace deepslate_bricks

# Frames go in BEFORE the skirting, otherwise the skirting has already
# turned Y -19 into polished_deepslate and the frames lose their bottom row.

# Blast-door frames: corridor mouth
fill ~-2 ~-19 ~10 ~2 ~-16 ~10 iron_block replace deepslate_bricks
fill ~-2 ~-19 ~11 ~2 ~-16 ~11 iron_block replace deepslate_bricks

# Blast-door frames: the four side rooms
fill ~-7 ~-19 ~13 ~-7 ~-16 ~16 iron_block replace deepslate_bricks
fill ~7 ~-19 ~13 ~7 ~-16 ~16 iron_block replace deepslate_bricks
fill ~-7 ~-19 ~19 ~-7 ~-16 ~22 iron_block replace deepslate_bricks
fill ~7 ~-19 ~19 ~7 ~-16 ~22 iron_block replace deepslate_bricks

# Skirting board around every wall (leaves the iron frames alone)
fill ~-14 ~-19 ~3 ~14 ~-19 ~28 polished_deepslate replace deepslate_bricks

# Support pillars in the main hall
fill ~-4 ~-19 ~15 ~-4 ~-15 ~15 chiseled_deepslate
fill ~4 ~-19 ~15 ~4 ~-15 ~15 chiseled_deepslate
fill ~-4 ~-19 ~19 ~-4 ~-15 ~19 chiseled_deepslate
fill ~4 ~-19 ~19 ~4 ~-15 ~19 chiseled_deepslate
