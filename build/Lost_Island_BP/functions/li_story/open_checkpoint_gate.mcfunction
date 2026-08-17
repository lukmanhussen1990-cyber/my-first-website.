fill 50 71 -91 54 73 -91 minecraft:air
playsound random.anvil_use @s ~ ~ ~ 0.9 0.8
titleraw @s actionbar {"rawtext":[{"text":"§aIt gives way."}]}
tellraw @s {"rawtext":[{"text":"§7The gate is chained and welded. It could be forced open."}]}
execute if score @s li_chapter matches ..5 run function li_story/chapter_6
