tag @s add li_z2
titleraw @s actionbar {"rawtext":[{"text":"§aDiscovered: §fSouth Camp"}]}
tellraw @s {"rawtext":[{"text":"§8[§eDiscovery§8] §fSouth Camp"}]}
playsound random.orb @s ~ ~ ~ 0.6 1.2
execute if score @s li_chapter matches 1 run function li_story/chapter_2
