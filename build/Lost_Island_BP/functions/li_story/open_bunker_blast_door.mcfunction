fill -23 35 -120 -21 37 -120 minecraft:air
playsound random.anvil_use @s ~ ~ ~ 0.9 0.8
titleraw @s actionbar {"rawtext":[{"text":"§aIt gives way."}]}
tellraw @s {"rawtext":[{"text":"§7A blast door. The manual release needs its key."}]}
execute if score @s li_chapter matches ..6 run function li_story/chapter_7
