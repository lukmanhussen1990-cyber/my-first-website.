clear @s li:canned_meat_used
effect @s saturation 1 6 true
scoreboard players add @s li_thirst 20
scoreboard players remove @s li_exh 12
playsound random.eat @s ~ ~ ~ 0.8 0.9
titleraw @s actionbar {"rawtext":[{"text":"§6You eat the tinned meat."}]}
