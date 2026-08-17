clear @s li:canned_beans_used
effect @s saturation 1 4 true
scoreboard players add @s li_thirst 40
scoreboard players remove @s li_exh 8
playsound random.eat @s ~ ~ ~ 0.8 1.0
titleraw @s actionbar {"rawtext":[{"text":"§6You eat the cold beans."}]}
