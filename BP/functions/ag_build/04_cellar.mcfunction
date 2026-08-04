# The Hollow Bride - step 4/8: the flooded Cellar of Names, under the hall.
# Interior x1010-1021, floor y49, water y50, air y51-56, ceiling y57.
fill 1009 48 1027 1022 57 1041 cobblestone
fill 1010 49 1028 1021 56 1040 air
fill 1010 49 1028 1021 49 1040 cobblestone
fill 1010 50 1028 1021 50 1040 water
fill 1010 57 1028 1021 57 1040 stone_bricks
fill 1010 51 1028 1010 56 1040 mossy_cobblestone
fill 1021 51 1028 1021 56 1040 mossy_cobblestone
fill 1010 51 1040 1021 56 1040 mossy_cobblestone
fill 1010 51 1028 1021 56 1028 mossy_cobblestone
# Reopen the shaft the ladder drops through.
fill 1020 51 1029 1020 56 1029 air
fill 1020 51 1029 1020 56 1029 ladder ["facing_direction"=4]
setblock 1020 50 1029 cobblestone
# The plaque wall, one course above the water.
fill 1011 51 1039 1016 53 1039 polished_deepslate
fill 1011 51 1039 1016 51 1039 air
# Standing stones so the player is never swimming blind.
fill 1013 50 1031 1017 50 1033 cobblestone
fill 1012 50 1036 1018 50 1037 cobblestone
setblock 1015 51 1031 air
# Two sconces: the cellar is meant to be dark, not unnavigable.
setblock 1011 53 1030 ag:wall_candle
setblock 1020 53 1038 ag:wall_candle
# Drowned dressing.
setblock 1012 51 1032 mossy_cobblestone
setblock 1018 51 1035 mossy_cobblestone
setblock 1014 51 1038 chain
setblock 1017 51 1038 chain
