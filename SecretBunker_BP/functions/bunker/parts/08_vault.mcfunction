# STEP 8 - The hidden vault.
#
# It sits BEHIND the south wall of the living quarters, and there is
# no door. The whole wall is bookshelves - only the middle three have
# the vault behind them. Break a bookshelf to get in, place it back
# to seal it. Nothing on the map or the surface hints it is there.

# Carve the vault (x -13..-9, z 25..27)
fill ~-13 ~-19 ~25 ~-9 ~-16 ~27 air

# Bookshelf wall in the quarters. Outer shelves are decoys - solid
# deepslate behind them.
fill ~-13 ~-19 ~24 ~-8 ~-17 ~24 bookshelf

# Vault lighting
fill ~-12 ~-15 ~25 ~-10 ~-15 ~27 sea_lantern

# Vault contents
fill ~-13 ~-19 ~27 ~-9 ~-19 ~27 chest
setblock ~-11 ~-19 ~25 ender_chest
setblock ~-13 ~-19 ~25 gold_block
setblock ~-9 ~-19 ~25 gold_block
setblock ~-12 ~-19 ~26 diamond_block
setblock ~-10 ~-19 ~26 emerald_block
