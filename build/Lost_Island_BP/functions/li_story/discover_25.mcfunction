tag @s add li_z25
titleraw @s actionbar {"rawtext":[{"text":"§aDiscovered: §fUnderground Bunker"}]}
tellraw @s {"rawtext":[{"text":"§8[§eDiscovery§8] §fUnderground Bunker"}]}
playsound random.orb @s ~ ~ ~ 0.6 1.2
execute if score @s li_chapter matches ..6 run function li_story/chapter_7
