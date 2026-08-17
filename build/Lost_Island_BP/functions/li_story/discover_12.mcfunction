tag @s add li_z12
titleraw @s actionbar {"rawtext":[{"text":"§aDiscovered: §fRadio Tower"}]}
tellraw @s {"rawtext":[{"text":"§8[§eDiscovery§8] §fRadio Tower"}]}
playsound random.orb @s ~ ~ ~ 0.6 1.2
execute if score @s li_chapter matches ..3 run function li_story/chapter_4
