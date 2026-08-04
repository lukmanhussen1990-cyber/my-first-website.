# The Hollow Bride - step 6/8: the Portrait Gallery, first floor of the tower.
# Interior x1010-1021, z1012-1026, floor y71, ceiling y77.
fill 1010 72 1012 1021 76 1026 air
fill 1010 71 1012 1021 71 1026 dark_oak_planks
fill 1010 76 1012 1021 76 1026 dark_oak_planks
fill 1010 72 1012 1021 72 1012 polished_deepslate
fill 1010 72 1026 1021 74 1026 polished_deepslate
fill 1010 72 1012 1010 74 1012 polished_deepslate
# The portrait wall is the south face; frames sit at y73.
fill 1010 73 1012 1021 73 1012 polished_deepslate
fill 1011 73 1012 1019 73 1012 air
setblock 1012 73 1012 dark_oak_log
setblock 1014 73 1012 dark_oak_log
setblock 1016 73 1012 dark_oak_log
setblock 1018 73 1012 dark_oak_log
# Runner and rail so the eye is led along the frames.
fill 1011 71 1014 1020 71 1014 red_carpet
fill 1011 72 1016 1011 72 1024 dark_oak_fence
fill 1020 72 1016 1020 72 1024 dark_oak_fence
# Two sconces only: the view cone puzzle needs shadow.
setblock 1011 74 1020 ag:wall_candle
setblock 1020 74 1020 ag:wall_candle
setblock 1015 75 1019 lantern
# Reopen the ladder column.
fill 1010 71 1013 1010 71 1013 air
fill 1010 77 1013 1010 77 1013 air
fill 1010 72 1013 1010 76 1013 ladder ["facing_direction"=5]
# Bench under the last frame.
fill 1017 71 1024 1019 71 1024 dark_oak_slab
