tag @s add li_z3
titleraw @s actionbar {"rawtext":[{"text":"§aDiscovered: §fFishing Shacks"}]}
tellraw @s {"rawtext":[{"text":"§8[§eDiscovery§8] §fFishing Shacks"}]}
playsound random.orb @s ~ ~ ~ 0.6 1.2
execute if score @s li_chapter matches 1 run function li_story/chapter_2
