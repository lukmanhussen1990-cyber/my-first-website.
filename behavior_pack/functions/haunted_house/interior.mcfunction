# --- HAUNTED HOUSE: interior decoration ---

# ---- Ground floor: hearth (glows, no fire so the house won't burn down) ----
fill ~-2 ~1 ~15 ~2 ~4 ~15 minecraft:cobblestone
fill ~-1 ~1 ~15 ~1 ~3 ~15 minecraft:air
setblock ~-1 ~1 ~15 minecraft:netherrack
setblock ~0 ~1 ~15 minecraft:magma
setblock ~1 ~1 ~15 minecraft:netherrack

# Witch's brewing corner
setblock ~-5 ~1 ~15 minecraft:cauldron
setblock ~-4 ~1 ~15 minecraft:crafting_table
setblock ~-5 ~1 ~14 minecraft:bookshelf
setblock ~-5 ~2 ~14 minecraft:bookshelf

# Pile of bones
setblock ~5 ~1 ~14 minecraft:bone_block
setblock ~4 ~1 ~15 minecraft:bone_block
setblock ~5 ~1 ~15 minecraft:soul_sand

# Ground-floor cobwebs
setblock ~-6 ~4 ~2 minecraft:web
setblock ~6 ~4 ~2 minecraft:web
setblock ~-6 ~4 ~16 minecraft:web
setblock ~6 ~4 ~16 minecraft:web
setblock ~-5 ~4 ~3 minecraft:web
setblock ~5 ~4 ~3 minecraft:web
setblock ~-5 ~4 ~15 minecraft:web
setblock ~5 ~4 ~15 minecraft:web
setblock ~0 ~3 ~2 minecraft:web

# Hanging soul lanterns (ground floor)
setblock ~-3 ~4 ~5 minecraft:soul_lantern
setblock ~3 ~4 ~12 minecraft:soul_lantern
setblock ~0 ~4 ~9 minecraft:soul_lantern

# ---- Second floor ----
setblock ~-4 ~6 ~5 minecraft:bookshelf
setblock ~-4 ~7 ~5 minecraft:bookshelf
setblock ~4 ~6 ~13 minecraft:crafting_table
setblock ~0 ~6 ~9 minecraft:soul_lantern
setblock ~-5 ~6 ~4 minecraft:web
setblock ~5 ~6 ~14 minecraft:web
setblock ~-3 ~8 ~4 minecraft:web
setblock ~3 ~8 ~14 minecraft:web

# A single Cursed Key waiting on the crafting table (custom item)
give @a haunted:cursed_key 1
