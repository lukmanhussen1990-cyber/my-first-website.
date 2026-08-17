clear @s li:clean_water_used
scoreboard players add @s li_thirst 400
execute if score @s li_thirst matches 1201.. run scoreboard players set @s li_thirst 1200
playsound random.drink @s ~ ~ ~ 0.8 1.0
give @s minecraft:glass_bottle 1
titleraw @s actionbar {"rawtext":[{"text":"§bWater +33"}]}
