tag @s add li_z5
titleraw @s actionbar {"rawtext":[{"text":"§aDiscovered: §fAbandoned Village"}]}
tellraw @s {"rawtext":[{"text":"§8[§eDiscovery§8] §fAbandoned Village"}]}
playsound random.orb @s ~ ~ ~ 0.6 1.2
execute if score @s li_chapter matches ..2 run function li_story/chapter_3
