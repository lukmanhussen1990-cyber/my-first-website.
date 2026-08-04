# The Hollow Bride - step 7/8: the Attic Heart and the locked bedroom.
# Interior x1010-1021, z1012-1026, floor y77, roof y86.
fill 1010 78 1012 1021 85 1026 air
fill 1010 77 1012 1021 77 1026 dark_oak_planks
fill 1010 85 1012 1021 85 1026 dark_oak_planks
fill 1010 78 1012 1021 80 1012 deepslate_bricks
fill 1010 78 1026 1021 80 1026 deepslate_bricks
fill 1010 78 1013 1010 80 1025 deepslate_bricks
fill 1021 78 1013 1021 80 1025 deepslate_bricks
fill 1011 78 1013 1020 84 1025 air
# Rafters. Cheap silhouette, no extra draw calls at ground level.
fill 1011 84 1015 1020 84 1015 dark_oak_log
fill 1011 84 1020 1020 84 1020 dark_oak_log
# The altar the veil hangs over.
fill 1014 77 1023 1017 77 1025 polished_deepslate
setblock 1015 78 1024 air
fill 1013 78 1022 1018 78 1022 dark_oak_fence
# The locked bedroom alcove: the second ending stands here.
fill 1010 78 1025 1012 80 1026 air
setblock 1012 78 1026 white_wool
setblock 1012 79 1026 white_wool
setblock 1011 78 1026 air
fill 1010 78 1024 1010 80 1024 deepslate_bricks
setblock 1010 78 1025 air
# Reopen the ladder column from the gallery.
fill 1010 77 1013 1010 77 1013 air
fill 1010 78 1013 1010 78 1013 air
# Four unlit sconces: phase one is a lighting puzzle.
setblock 1011 78 1014 ag:wall_candle
setblock 1020 78 1014 ag:wall_candle
setblock 1011 78 1024 ag:wall_candle
setblock 1020 78 1024 ag:wall_candle
# Salt is stocked here so the Chorus phase is always winnable.
setblock 1013 78 1016 barrel
setblock 1018 78 1016 barrel
