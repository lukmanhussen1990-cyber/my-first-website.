# Fills the bunker back in with plain stone and deletes the boulders.
#
# IMPORTANT: stand on the EXACT block you built from, or this will
# carve up the wrong chunk of world. Anything in the chests is lost.

fill ~-14 ~-21 ~3 ~14 ~-13 ~28 stone
fill ~14 ~-21 ~19 ~32 ~-13 ~21 stone
fill ~-1 ~-12 ~3 ~1 ~-1 ~5 stone
fill ~29 ~-12 ~19 ~31 ~-1 ~21 stone
fill ~-2 ~0 ~2 ~2 ~3 ~6 air
fill ~28 ~0 ~18 ~32 ~3 ~22 air
setblock ~-5 ~0 ~3 air
setblock ~-6 ~0 ~5 air
setblock ~-4 ~0 ~8 air
setblock ~5 ~0 ~2 air
setblock ~6 ~0 ~6 air
setblock ~4 ~0 ~9 air
setblock ~-7 ~0 ~9 air
tellraw @s {"rawtext":[{"text":"§8[§aBUNKER§8] §7Removed."}]}
