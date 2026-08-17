clear @s li:battery_used
scoreboard players add @s li_bat 40
execute if score @s li_bat matches 101.. run scoreboard players set @s li_bat 100
playsound random.click @s ~ ~ ~ 0.8 1.2
titleraw @s actionbar {"rawtext":[{"text":"§eTorch charged."}]}
