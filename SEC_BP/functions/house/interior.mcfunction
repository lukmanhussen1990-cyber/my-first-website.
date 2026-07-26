# Furniture and workstations. Called by house/build.

# Workshop along the north wall.
setblock ~3 ~ ~-6 minecraft:crafting_table
setblock ~4 ~ ~-6 minecraft:furnace
setblock ~5 ~ ~-6 minecraft:blast_furnace
setblock ~6 ~ ~-6 minecraft:smoker

# Tool bench along the east wall.
setblock ~6 ~ ~-5 minecraft:anvil
setblock ~6 ~ ~-4 minecraft:grindstone
setblock ~6 ~ ~-3 minecraft:cartography_table
setblock ~6 ~ ~-2 minecraft:stonecutter_block
setblock ~6 ~ ~-1 minecraft:loom

# Enchanting corner: table ringed by bookshelves two blocks out.
setblock ~4 ~ ~3 minecraft:enchanting_table
setblock ~2 ~ ~1 minecraft:bookshelf
setblock ~2 ~ ~3 minecraft:bookshelf
setblock ~2 ~ ~5 minecraft:bookshelf
setblock ~4 ~ ~1 minecraft:bookshelf
setblock ~4 ~ ~5 minecraft:bookshelf
setblock ~6 ~ ~1 minecraft:bookshelf
setblock ~6 ~ ~3 minecraft:bookshelf
setblock ~6 ~ ~5 minecraft:bookshelf

# Living quarters along the west wall.
setblock ~-6 ~ ~4 minecraft:bed ["direction":0,"head_piece_bit":false,"occupied_bit":false]
setblock ~-6 ~ ~3 minecraft:bed ["direction":0,"head_piece_bit":true,"occupied_bit":false]
setblock ~-6 ~ ~1 minecraft:cauldron
setblock ~6 ~ ~5 minecraft:brewing_stand

# General storage along the south wall, clear of the doorway.
setblock ~-6 ~ ~6 minecraft:chest
setblock ~-5 ~ ~6 minecraft:chest
setblock ~-4 ~ ~6 minecraft:chest
setblock ~-3 ~ ~6 minecraft:chest
setblock ~5 ~ ~6 minecraft:chest
setblock ~6 ~ ~6 minecraft:chest
