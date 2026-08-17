clear @s li:flare_used
setblock ~ ~ ~ minecraft:torch
particle minecraft:large_explosion ~ ~1 ~
playsound fire.ignite @s ~ ~ ~ 1.0 0.6
effect @e[family=li_hostile,r=14] slowness 8 1 true
damage @e[family=li_hostile,r=6] 2 fire
titleraw @s actionbar {"rawtext":[{"text":"§cThe flare hisses and burns."}]}
