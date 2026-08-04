# The Hollow Bride - step 3/8: the north wing shell and the Nursery.
# North wing exterior x999-1032, z1027-1041. Interior x1000-1031, z1028-1040.
fill 999 64 1027 1032 71 1041 deepslate_bricks hollow
fill 1000 64 1028 1031 70 1040 air
fill 1000 64 1028 1031 64 1040 dark_oak_planks
fill 999 71 1027 1032 71 1041 dark_oak_planks
# Partitions: nursery wall at x1009, mirror wing wall at x1022.
fill 1009 65 1028 1009 70 1040 deepslate_bricks
fill 1022 65 1028 1022 70 1040 deepslate_bricks
fill 1009 65 1034 1009 67 1035 air
fill 1022 65 1034 1022 67 1035 air
# Hall lighting so the corridor is never a guessing game.
setblock 1012 68 1030 lantern
setblock 1019 68 1030 lantern
setblock 1012 68 1038 lantern
setblock 1019 68 1038 lantern
# Nursery floor and walls.
fill 1000 64 1028 1008 64 1040 spruce_planks
fill 1000 65 1028 1008 65 1028 stripped_spruce_log
fill 1000 68 1028 1008 68 1040 stripped_spruce_log
# Cot, rug, shelves.
fill 1003 65 1029 1005 65 1030 spruce_slab
setblock 1004 66 1029 white_wool
fill 1001 65 1035 1002 65 1037 red_carpet
fill 1006 65 1030 1006 66 1030 bookshelf
fill 1001 65 1039 1002 66 1039 bookshelf
# Toy shelf the melody sits on.
fill 1003 64 1033 1007 64 1033 stripped_spruce_log
# Hiding furniture.
setblock 1002 65 1031 ag:wardrobe
setblock 1007 65 1036 ag:wardrobe
setblock 1004 65 1029 ag:under_bed
# Nursery is dim on purpose; two dead sconces only.
setblock 1000 67 1032 ag:wall_candle
setblock 1008 67 1037 ag:wall_candle
