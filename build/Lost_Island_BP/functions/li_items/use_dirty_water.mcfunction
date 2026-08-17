clear @s li:dirty_water_used
scoreboard players add @s li_thirst 250
execute if score @s li_thirst matches 1201.. run scoreboard players set @s li_thirst 1200
playsound random.drink @s ~ ~ ~ 0.8 1.0
give @s minecraft:glass_bottle 1
titleraw @s actionbar {"rawtext":[{"text":"§bWater +20"}]}
execute if score #rand li_sys matches 0..8 run function li_items/dirty_sick
