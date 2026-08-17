tag @s add li_n40
playsound random.pop @s ~ ~ ~ 0.5 1.3
tellraw @s {"rawtext":[{"text":"§8[§7final record§8]"}]}
tellraw @s {"rawtext":[{"text":"§7§oThe anomaly was here before the island had a name. We did not create anything. We WOKE something, and then we studied it until it studied us."}]}
titleraw @s actionbar {"rawtext":[{"text":"§7You found a §ffinal record§7."}]}
execute if score @s li_chapter matches ..7 run function li_story/truth
