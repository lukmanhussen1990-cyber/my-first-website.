# The Hollow Bride - step 2/8: the south tower shell and the Foyer.
# South tower exterior x1009-1022, z1011-1027. Interior x1010-1021, z1012-1026.
fill 1009 64 1011 1022 86 1027 deepslate_bricks hollow
fill 1010 64 1012 1021 85 1026 air
fill 1010 64 1012 1021 64 1026 dark_oak_planks
fill 1010 71 1012 1021 71 1026 dark_oak_planks
fill 1010 77 1012 1021 77 1026 dark_oak_planks
fill 1009 86 1011 1022 86 1027 dark_oak_planks
# Front doorway, permanently re-openable so the run can never soft lock.
fill 1014 65 1011 1016 67 1011 air
fill 1014 65 1010 1016 67 1010 air
# Doorway north into the wing hall.
fill 1014 65 1027 1016 67 1027 air
# Foyer dressing.
fill 1010 65 1012 1021 65 1012 dark_oak_planks
setblock 1011 65 1013 ag:grandfather_clock
setblock 1011 66 1013 dark_oak_planks
fill 1019 65 1013 1020 65 1014 dark_oak_stairs
setblock 1013 65 1025 dark_oak_fence
setblock 1018 65 1025 dark_oak_fence
setblock 1013 66 1025 lantern
setblock 1018 66 1025 lantern
fill 1010 69 1013 1010 69 1025 dark_oak_planks
fill 1012 66 1012 1012 68 1012 gray_stained_glass_pane
fill 1019 66 1012 1019 68 1012 gray_stained_glass_pane
# Ladder shaft up the west wall: foyer to gallery to attic.
fill 1010 71 1013 1010 71 1013 air
fill 1010 77 1013 1010 77 1013 air
fill 1010 65 1013 1010 76 1013 ladder ["facing_direction"=5]
# Cellar shaft down from the hall, ladder against the east partition.
fill 1020 64 1029 1020 64 1029 air
fill 1020 51 1029 1020 63 1029 air
fill 1020 51 1029 1020 63 1029 ladder ["facing_direction"=4]
fill 1021 51 1029 1021 63 1029 cobblestone
# Salt and tallow cache by the door.
setblock 1012 65 1024 barrel
setblock 1019 65 1024 barrel
