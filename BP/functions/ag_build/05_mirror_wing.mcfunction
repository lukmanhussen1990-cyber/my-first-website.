# The Hollow Bride - step 5/8: the Mirror Wing, east of the hall.
# Interior x1023-1031, z1028-1040.
fill 1023 64 1028 1031 64 1040 polished_deepslate
fill 1023 65 1028 1031 70 1040 air
fill 1023 68 1028 1031 68 1040 polished_deepslate
fill 1023 65 1028 1031 65 1028 polished_deepslate
fill 1023 65 1040 1031 67 1040 polished_deepslate
fill 1023 65 1029 1023 67 1039 polished_deepslate
fill 1031 65 1029 1031 67 1039 polished_deepslate
fill 1024 65 1029 1030 67 1039 air
# Doorway through from the hall.
fill 1023 65 1034 1023 67 1035 air
# The mirror wall itself, one course back so the frames read as frames.
fill 1023 65 1039 1031 67 1039 polished_deepslate
fill 1023 65 1039 1031 65 1039 air
# Frames between the glasses.
setblock 1025 65 1039 dark_oak_log
setblock 1027 65 1039 dark_oak_log
setblock 1029 65 1039 dark_oak_log
setblock 1031 65 1039 dark_oak_log
# Sconces, deliberately sparse.
setblock 1024 67 1030 ag:wall_candle
setblock 1030 67 1030 ag:wall_candle
# A bench so the room has a focal point to stand at.
fill 1026 65 1033 1028 65 1033 dark_oak_slab
setblock 1027 66 1033 lantern
