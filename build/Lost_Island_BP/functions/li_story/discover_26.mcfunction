tag @s add li_z26
titleraw @s actionbar {"rawtext":[{"text":"§aDiscovered: §fSecret Research Complex"}]}
tellraw @s {"rawtext":[{"text":"§8[§eDiscovery§8] §fSecret Research Complex"}]}
playsound random.orb @s ~ ~ ~ 0.6 1.2
execute if score @s li_chapter matches ..7 run function li_story/chapter_8
function li_mobs/spawn_alpha
