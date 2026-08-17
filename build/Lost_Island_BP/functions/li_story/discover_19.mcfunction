tag @s add li_z19
titleraw @s actionbar {"rawtext":[{"text":"§aDiscovered: §fHarbour"}]}
tellraw @s {"rawtext":[{"text":"§8[§eDiscovery§8] §fHarbour"}]}
playsound random.orb @s ~ ~ ~ 0.6 1.2
execute if score @s li_chapter matches ..4 run function li_story/chapter_5
