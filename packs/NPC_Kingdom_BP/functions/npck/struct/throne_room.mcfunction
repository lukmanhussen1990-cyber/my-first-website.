fill ~-6 ~1 ~-6 ~6 ~1 ~6 polished_andesite
fill ~-2 ~1 ~-6 ~2 ~1 ~5 red_carpet
fill ~-2 ~1 ~5 ~2 ~1 ~5 gold_block
fill ~-1 ~2 ~5 ~1 ~2 ~5 gold_block
setblock ~ ~3 ~5 gold_block
setblock ~-2 ~2 ~5 glowstone
setblock ~2 ~2 ~5 glowstone
fill ~-4 ~1 ~4 ~-4 ~4 ~4 gold_block
fill ~4 ~1 ~4 ~4 ~4 ~4 gold_block
setblock ~-4 ~5 ~4 glowstone
setblock ~4 ~5 ~4 glowstone
fill ~-6 ~2 ~-2 ~-6 ~4 ~2 red_wool
fill ~6 ~2 ~-2 ~6 ~4 ~2 red_wool
setblock ~-5 ~1 ~-4 chest
setblock ~5 ~1 ~-4 chest
execute unless entity @e[type=npck:throne_seat,r=8] run summon npck:throne_seat ~ ~1.55 ~5
