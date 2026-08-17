tag @s remove li_night
fog @s pop li_night
titleraw @s actionbar {"rawtext":[{"text":"§fDawn. You made it through."}]}
scoreboard players remove @s li_exh 20
execute if score @s li_chapter matches 1 run function li_story/chapter_2
